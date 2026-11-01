package com.growtogether.storage;
import static org.mockito.Mockito.*;
import java.util.*;
import org.junit.jupiter.api.Test;
class FileCleanupTest {
    @Test void retriesAreIndependentSoOneProviderFailureDoesNotBlockOtherFiles() {
        var repository = mock(FileRepository.class);
        var service = mock(FileService.class);
        var first = UUID.randomUUID(); var second = UUID.randomUUID();
        when(repository.findCleanupCandidates(any(), any())).thenReturn(List.of(first, second));
        doThrow(new IllegalStateException("provider failure")).when(service).cleanup(first);
        new FileCleanup(repository, service).run();
        verify(service).cleanup(first);
        verify(service).cleanup(second);
    }
}
