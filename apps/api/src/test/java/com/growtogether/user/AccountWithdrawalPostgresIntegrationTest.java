package com.growtogether.user;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.growtogether.auth.AuthRepository;
import com.growtogether.storage.StorageDeletionJobs;
import com.growtogether.storage.StorageService;
import com.jayway.jsonpath.JsonPath;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.testcontainers.containers.PostgreSQLContainer;
import software.amazon.awssdk.services.s3.model.S3Exception;

@SpringBootTest(properties = {"spring.datasource.driver-class-name=org.postgresql.Driver", "spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=validate", "app.storage.deletion.enabled=false"})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class AccountWithdrawalPostgresIntegrationTest {
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine").withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"));
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        String local = System.getenv("WITHDRAWAL_POSTGRES_URL");
        if (local != null) {
            r.add("spring.datasource.url", () -> local);
            r.add("spring.datasource.username", () -> "postgres");
            r.add("spring.datasource.password", () -> "postgres");
        } else {
            postgres.start();
            r.add("spring.datasource.url", postgres::getJdbcUrl);
            r.add("spring.datasource.username", postgres::getUsername);
            r.add("spring.datasource.password", postgres::getPassword);
        }
    }
    @org.junit.jupiter.api.AfterAll static void stop() { if (postgres.isRunning()) postgres.stop(); }
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @Autowired AuthRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired AccountWithdrawalService accounts;
    @Autowired StorageDeletionJobs deletion;
    @Autowired Clock clock;
    @Autowired PlatformTransactionManager transactions;
    @MockitoBean StorageService storage;
    private static final String PASSWORD = "password-123";
    private User user() { return users.saveAndFlush(new User("보호자", UUID.randomUUID()+"@example.test", passwords.encode(PASSWORD))); }
    private String token(User user) throws Exception {
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\""+user.getEmail()+"\",\"password\":\""+PASSWORD+"\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.accessToken");
    }
    private UUID file(Long owner, String key, String state) {
        UUID id = UUID.randomUUID();
        db.update("INSERT INTO stored_files(id,owner_id,object_key,original_filename,content_type,file_size,status,created_at) VALUES(?,?,?,'photo','image/jpeg',10,?,?)",
            id, owner, key, state, Timestamp.from(clock.instant()));
        return id;
    }
    private long count(String table, String column, Object owner) {
        return db.queryForObject("SELECT count(*) FROM "+table+" WHERE "+column+" = ?", Long.class, owner);
    }
    @Test void deletesOnlyOwnerAndRejectsEveryOldDeviceToken() throws Exception {
        User owner=user(), other=user(); String one=token(owner), two=token(owner), otherToken=token(other);
        UUID image=file(owner.getId(), "files/"+owner.getId()+"/linked", "COMPLETED");
        file(owner.getId(), "files/"+owner.getId()+"/pending", "PENDING");
        file(other.getId(), "files/"+other.getId()+"/kept", "COMPLETED");
        Long diary=db.queryForObject("INSERT INTO diary(user_id,diary_date,content) VALUES(?,'2026-11-28','private') RETURNING id", Long.class, owner.getId());
        db.update("INSERT INTO diary_file(diary_id,stored_file_id) VALUES(?,?)",diary,image);
        db.update("INSERT INTO todo(user_id,diary_id,plan_name,scheduled_date,scheduled_time) VALUES(?,?,'play','2026-11-28','10:00')",owner.getId(),diary);
        db.update("INSERT INTO child_profile(user_id,name,birthday) VALUES(?,'아이','2024-01-01')",owner.getId());
        db.update("INSERT INTO child_profile_concern(user_id,position,concern) VALUES(?,0,'sleep')",owner.getId());
        mvc.perform(post("/api/v1/users/me/withdrawal").header("Authorization","Bearer "+one).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"wrong\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PASSWORD"));
        assertThat(count("diary","user_id",owner.getId())).isEqualTo(1);
        mvc.perform(post("/api/v1/users/me/withdrawal").header("Authorization","Bearer "+one).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\""+PASSWORD+"\"}"))
            .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control","no-store"));
        for(String table:new String[]{"users","auth_sessions","diary","todo","stored_files","child_profile","child_profile_concern"}) {
            String col=table.equals("users")?"id":table.equals("stored_files")?"owner_id":"user_id";
            assertThat(count(table,col,owner.getId())).isZero();
        }
        assertThat(count("diary_file","diary_id",diary)).isZero();
        assertThat(db.queryForObject("SELECT count(*) FROM storage_deletion_jobs WHERE object_key LIKE ?",Long.class,"files/"+owner.getId()+"/%")).isEqualTo(2);
        for(String token:new String[]{one,two}) mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+otherToken)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/users/me/withdrawal").header("Authorization","Bearer "+one).contentType(MediaType.APPLICATION_JSON).content("{\"password\":\""+PASSWORD+"\"}"))
            .andExpect(status().isUnauthorized());
        assertThat(count("stored_files","owner_id",other.getId())).isEqualTo(1);
    }
    @Test void validationAndMissingAuthenticationNeverDelete() throws Exception {
        User owner=user();String access=token(owner);
        mvc.perform(post("/api/v1/users/me/withdrawal").contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"x\"}" )).andExpect(status().isUnauthorized());
        for(String body:new String[]{"{}","{\"password\":\" \"}","{\"password\":\""+"x".repeat(73)+"\"}"})
            mvc.perform(post("/api/v1/users/me/withdrawal").header("Authorization","Bearer "+access).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        assertThat(users.existsById(owner.getId())).isTrue();
        assertThat(new com.growtogether.user.dto.WithdrawalRequest("secret").toString()).doesNotContain("secret");
    }
    @Test void failedDatabaseDeletionRollsBackRowsAndJobs() {
        User owner=user();String key="files/"+owner.getId()+"/rollback";file(owner.getId(),key,"PENDING");
        db.execute("CREATE TABLE withdrawal_guard(user_id BIGINT REFERENCES users(id))");
        try {
            db.update("INSERT INTO withdrawal_guard VALUES(?)",owner.getId());
            assertThatThrownBy(()->accounts.withdraw(owner.getId(),PASSWORD)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
            assertThat(users.existsById(owner.getId())).isTrue();
            assertThat(count("stored_files","owner_id",owner.getId())).isEqualTo(1);
            assertThat(count("storage_deletion_jobs","object_key",key)).isZero();
        } finally {db.execute("DROP TABLE withdrawal_guard");}
    }
    @Test void deletionRetriesAcrossInstancesAndSweepsAfterSignedPutExpiry() {
        String key="files/jobs/"+UUID.randomUUID();Instant now=clock.instant();
        db.update("INSERT INTO storage_deletion_jobs VALUES(?,?,?,0)",key,Timestamp.from(now.minusSeconds(1)),Timestamp.from(now.plusSeconds(600)));
        doThrow(new IllegalStateException("storage unavailable")).doNothing().when(storage).delete(key);
        deletion.processBatch();
        assertThat(db.queryForObject("SELECT attempts FROM storage_deletion_jobs WHERE object_key=?",Integer.class,key)).isEqualTo(1);
        db.update("UPDATE storage_deletion_jobs SET next_attempt_at=? WHERE object_key=?",Timestamp.from(now.minusSeconds(1)),key);
        new StorageDeletionJobs(db,storage,clock).processBatch();
        assertThat(count("storage_deletion_jobs","object_key",key)).isEqualTo(1);
        db.update("UPDATE storage_deletion_jobs SET next_attempt_at=?,final_after=? WHERE object_key=?",Timestamp.from(now.minusSeconds(1)),Timestamp.from(now.minusSeconds(1)),key);
        doThrow(S3Exception.builder().statusCode(404).build()).when(storage).delete(key);
        deletion.processBatch();
        assertThat(count("storage_deletion_jobs","object_key",key)).isZero();
        verify(storage,times(3)).delete(key);
    }
    @Test void twoDeletionWorkersDoNotProcessTheSameLockedJob() throws Exception {
        String key="files/jobs/"+UUID.randomUUID();var past=Timestamp.from(clock.instant().minusSeconds(1));
        db.update("INSERT INTO storage_deletion_jobs VALUES(?,?,?,0)",key,past,past);
        var entered=new CountDownLatch(1);var release=new CountDownLatch(1);
        doAnswer(call->{entered.countDown();if(!release.await(10,TimeUnit.SECONDS))throw new IllegalStateException("timeout");return null;}).when(storage).delete(key);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(()->deletion.processBatch());
            assertThat(entered.await(10,TimeUnit.SECONDS)).isTrue();
            var second=pool.submit(()->deletion.processBatch());
            second.get(5,TimeUnit.SECONDS);
            verify(storage,times(1)).delete(key);
            release.countDown();first.get(10,TimeUnit.SECONDS);
        } finally {release.countDown();}
        assertThat(count("storage_deletion_jobs","object_key",key)).isZero();
    }

    @Test void concurrentFileRegistrationCommitsBeforeWithdrawalSnapshot() throws Exception {
        User owner=user();String key="files/"+owner.getId()+"/concurrent";
        var inserted=new CountDownLatch(1);var release=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            var writer=executor.submit(()->new TransactionTemplate(transactions).execute(status->{
                file(owner.getId(),key,"PENDING");inserted.countDown();
                try {if(!release.await(10,TimeUnit.SECONDS))throw new IllegalStateException("timeout");}catch(InterruptedException e){throw new RuntimeException(e);}return null;
            }));
            assertThat(inserted.await(10,TimeUnit.SECONDS)).isTrue();
            var withdrawn=executor.submit(()->accounts.withdraw(owner.getId(),PASSWORD));
            release.countDown();writer.get(15,TimeUnit.SECONDS);withdrawn.get(15,TimeUnit.SECONDS);
        }
        assertThat(count("storage_deletion_jobs","object_key",key)).isEqualTo(1);
        assertThat(count("stored_files","owner_id",owner.getId())).isZero();
    }
}
