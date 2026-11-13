import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useNavigationState, usePreventRemove } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth-provider';
import { useChildProfile } from '../../lib/use-child-profile';
import { createChildApi } from '../../lib/features/child/childApi';
import type { ChildProfile } from '../../lib/child-profile';
import { ApiError } from '../../lib/api/errors';
import { onboardingDrafts } from '../../lib/onboarding-draft-storage';
import type { OnboardingDraft } from '../../lib/onboarding-draft';
import {
  ageInMonths,
  emptyPersonalization,
  personalizationSaved,
  validPersonalization,
  validateOnboarding,
  type OnboardingProfile,
  type Personalization,
} from '../../lib/onboarding';
import { useReduceMotion } from '../../theme/motion';
import { ActionButton } from '../action-button';
import { OnboardingStep, titles, descriptions } from './onboarding-steps';
import { styles } from './onboarding-styles';
import { editorial } from '../../theme/editorial';
import { colors } from '../../theme/colors';

export function ChildOnboarding({ initial }: { initial: ChildProfile | null }) {
  const { client, accountKey, epoch } = useAuth();
  const profileQuery = useChildProfile();
  const privateRoutesReady = useNavigationState((state) =>
    state.routeNames.includes('(tabs)'),
  );
  const queryClient = useQueryClient();
  const editing = initial !== null;
  const supportsChoices =
    !initial || validPersonalization(initial.personalization);
  const initialValue: OnboardingProfile = {
    name: initial?.name ?? '',
    birthday: initial?.birthday ?? '',
    personalization: validPersonalization(initial?.personalization)
      ? initial!.personalization!
      : emptyPersonalization(),
  };
  const [value, setValue] = useState(initialValue);
  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState<'/main' | '/children' | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [resume, setResume] = useState<OnboardingDraft | null>(null);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [existing, setExisting] = useState<ChildProfile | null>(null);
  const [savedResult, setSavedResult] = useState<ChildProfile | null>(null);
  const [partial, setPartial] = useState<ChildProfile | null>(null);
  const touched = useRef(false),
    completed = useRef(false),
    pending = useRef(false);
  const reduced = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollView>(null);
  const heading = useRef<Text>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (destination && profileQuery.data && privateRoutesReady && !busy)
      router.dismissTo(destination);
  }, [destination, profileQuery.data, privateRoutesReady, busy]);
  const current = () =>
    alive.current &&
    client.getSnapshot().epoch === epoch &&
    client.getSnapshot().accountKey === accountKey;
  usePreventRemove(busy, () => {});
  useEffect(() => {
    let alive = true;
    if (!accountKey) return;
    void onboardingDrafts
      .read(accountKey)
      .then((d) => {
        if (alive) setResume(d);
      })
      .catch(() => {
        if (alive)
          setNotice(
            '임시 입력을 읽지 못했어요. 새로 입력하거나 다시 방문해주세요.',
          );
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [accountKey]);
  useEffect(() => {
    if (
      !ready ||
      resume ||
      !accountKey ||
      !touched.current ||
      completed.current ||
      !current()
    )
      return;
    void onboardingDrafts
      .write(accountKey, {
        profile: value,
        step,
        mode: editing ? 'edit' : 'create',
        savedAt: Date.now(),
      })
      .catch(() => {
        if (current())
          setNotice(
            '임시 입력을 보관하지 못했어요. 화면을 닫으면 입력이 사라질 수 있어요.',
          );
      });
    // Epoch/account changes remount the editor; no other account may receive this write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, step, ready, resume, accountKey, epoch, editing]);
  useEffect(() => {
    if (!ready || resume) return;
    if (Platform.OS === 'web') {
      const node = heading.current as unknown as {
        setAttribute?: (key: string, value: string) => void;
        focus?: () => void;
      };
      node?.setAttribute?.('tabindex', '-1');
      node?.focus?.();
    }
    scroll.current?.scrollTo({ y: 0, animated: false });
    opacity.setValue(reduced ? 1 : 0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: reduced ? 0 : 180,
      useNativeDriver: true,
    });
    animation.start();
    if (Platform.OS !== 'web')
      AccessibilityInfo.announceForAccessibility(
        `${step + 1}단계. ${titles[step]}`,
      );
    return () => animation.stop();
  }, [step, opacity, reduced, ready, resume]);
  const update = (next: OnboardingProfile) => {
    touched.current = true;
    setValue(next);
    setErrors({});
    setNotice('');
  };
  const choices = (next: Partial<Personalization>) =>
    update({
      ...value,
      personalization: { ...value.personalization, ...next },
    });
  const next = () => {
    if (step === 0) {
      const e = validateOnboarding(value);
      if (Object.keys(e).length) {
        setErrors(e);
        setNotice('입력한 기본 정보를 확인해주세요.');
        return;
      }
    }
    touched.current = true;
    setStep(Math.min(4, step + 1));
    setNotice('');
  };
  const finish = async (result: ChildProfile) => {
    completed.current = true;
    setSavedResult(result);
    try {
      await onboardingDrafts.clear(accountKey!);
      if (!current()) return;
      await queryClient.cancelQueries({
        queryKey: profileQuery.queryKey,
        exact: true,
      });
      if (!current()) return;
      queryClient.setQueryData(profileQuery.queryKey, result);
      void queryClient.invalidateQueries({
        queryKey: profileQuery.queryKey,
        exact: true,
      });
      setDestination(editing ? '/children' : '/main');
    } catch {
      if (current())
        setNotice(
          '서버 저장은 완료됐지만 임시 입력을 지우지 못했어요. 정리를 다시 시도해주세요.',
        );
    }
  };
  const save = async () => {
    if (pending.current || blocked || savedResult || partial) return;
    const input = { ...value, name: value.name.trim() };
    const e = validateOnboarding(input);
    if (Object.keys(e).length) {
      setErrors(e);
      setStep(0);
      return;
    }
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      const api = createChildApi(client);
      const payload = supportsChoices
        ? input
        : { name: input.name, birthday: input.birthday };
      const result = editing
        ? await api.saveProfile(payload)
        : await api.createProfile(payload);
      if (!current()) return;
      if (
        !result ||
        result.name !== input.name ||
        result.birthday !== input.birthday
      ) {
        throw new ApiError(
          502,
          'INVALID_RESPONSE',
          '저장 응답을 확인하지 못했어요.',
        );
      }
      if (!personalizationSaved(input, result)) {
        setPartial(result);
        setNotice(
          '기본 정보는 저장됐지만 선택 정보의 저장을 확인하지 못했어요. 입력은 보관하고 있어요.',
        );
        return;
      }
      await finish(result);
    } catch (error) {
      if (!current()) return;
      const uncertain =
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500 || error.status === 409);
      setBlocked(uncertain);
      setNotice(
        uncertain
          ? '등록 여부를 확인해야 해요. 입력은 유지했어요. 기존 등록 정보를 먼저 확인해주세요.'
          : '저장하지 못했어요. 입력은 유지했어요. 다시 확인하고 시도해주세요.',
      );
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  const inspect = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const found = await createChildApi(client).getProfile();
      if (!current()) return;
      if (found && personalizationSaved(value, found)) {
        await finish(found);
        return;
      }
      setExisting(found);
      if (!found) {
        setBlocked(false);
        setNotice(
          '등록된 아이 정보가 없어요. 입력을 유지했으니 다시 저장할 수 있어요.',
        );
      } else
        setNotice(
          '이미 등록된 정보를 확인해주세요. 현재 입력으로 자동 덮어쓰지 않아요.',
        );
    } catch {
      if (current())
        setNotice('등록 정보를 확인하지 못했어요. 다시 시도해주세요.');
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  const months = ageInMonths(value.birthday);
  if (destination)
    return (
      <View style={styles.loading}>
        <Text style={styles.body}>저장한 정보로 이동하고 있어요.</Text>
      </View>
    );
  if (!ready)
    return (
      <View style={styles.loading}>
        <Text style={styles.body}>임시 입력을 확인하고 있어요.</Text>
      </View>
    );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.top}>
            <Text style={styles.brand}>같이 키우기</Text>
            {!editing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="메인으로 돌아가기"
                disabled={busy}
                style={styles.exit}
                onPress={() => router.dismissTo('/main')}
              >
                <Text style={styles.hint}>뒤로</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                editing ? router.replace('/children') : void client.logout()
              }
              style={styles.exit}
            >
              <Text style={styles.hint}>
                {editing ? '프로필로 돌아가기' : '로그아웃'}
              </Text>
            </Pressable>
          </View>
          {resume ? (
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.subtitle}>
                작성하던 아이 소개가 있어요
              </Text>
              <Text style={styles.body}>
                24시간 이내의 임시 입력이에요.{' '}
                {editing
                  ? '이어 작성한 내용은 확인 후 직접 저장할 수 있어요.'
                  : ''}
              </Text>
              <ActionButton
                label="이어서 작성하기"
                variant="primary"
                onPress={() => {
                  touched.current = true;
                  setValue(resume.profile);
                  setStep(resume.step);
                  setResume(null);
                }}
              />
              <ActionButton
                label="임시 입력 버리고 새로 시작"
                variant="tertiary"
                onPress={() => {
                  void onboardingDrafts
                    .clear(accountKey!)
                    .then(() => {
                      touched.current = false;
                      setResume(null);
                      setValue(initialValue);
                      setStep(0);
                    })
                    .catch(() =>
                      setNotice(
                        '임시 입력을 삭제하지 못했어요. 다시 시도해주세요.',
                      ),
                    );
                }}
              />
            </View>
          ) : (
            <>
              <Text style={editorial.eyebrow}>PERSONALIZE OUR DAY</Text>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={`자녀 등록 ${step + 1}/5단계`}
                accessibilityValue={{ min: 1, max: 5, now: step + 1 }}
                style={styles.progress}
              >
                {titles.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressPart,
                      i <= step && { backgroundColor: colors.primary },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.eyebrow}>
                아이의 첫 이야기 · {step + 1} / 5
              </Text>
              <Animated.View style={{ opacity, gap: 20 }}>
                <View style={{ gap: 10 }}>
                  <Text
                    ref={heading}
                    accessibilityRole="header"
                    style={styles.title}
                  >
                    {titles[step]}
                  </Text>
                  <Text style={styles.body}>{descriptions[step]}</Text>
                </View>
                {!supportsChoices ? (
                  <Text accessibilityRole="alert" style={styles.notice}>
                    현재 서버는 기본 정보만 지원해요. 선택 항목은 입력할 수
                    없으며 저장됐다고 안내하지 않아요.
                  </Text>
                ) : null}
                <View
                  style={styles.card}
                  pointerEvents={busy ? 'none' : 'auto'}
                >
                  <OnboardingStep
                    step={step}
                    value={value}
                    errors={errors}
                    months={months}
                    supportsChoices={supportsChoices}
                    update={update}
                    choices={choices}
                  />
                </View>
              </Animated.View>
              <View style={styles.actions}>
                {step > 0 ? (
                  <ActionButton
                    label="이전"
                    variant="tertiary"
                    disabled={busy}
                    onPress={() => {
                      setStep(step - 1);
                      setNotice('');
                    }}
                  />
                ) : null}
                {step < 4 ? (
                  <ActionButton
                    label="다음"
                    variant="primary"
                    disabled={busy}
                    onPress={next}
                  />
                ) : (
                  <ActionButton
                    variant="primary"
                    label={
                      busy
                        ? '저장 중…'
                        : editing
                          ? '개인화 설정 저장'
                          : '같이 키우기 시작하기'
                    }
                    disabled={busy || blocked || !!savedResult || !!partial}
                    onPress={() => void save()}
                  />
                )}
                {step > 0 && step < 4 ? (
                  <ActionButton
                    label="건너뛰기"
                    variant="tertiary"
                    disabled={busy}
                    onPress={() => {
                      if (step === 1) choices({ concerns: [] });
                      if (step === 3) choices({ availableActivityTime: null });
                      next();
                    }}
                  />
                ) : null}
              </View>
            </>
          )}
          {notice ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.notice}
            >
              {notice}
            </Text>
          ) : null}
          {blocked ? (
            <ActionButton
              label="기존 등록 정보 확인"
              variant="secondary"
              disabled={busy}
              onPress={() => void inspect()}
            />
          ) : null}
          {existing ? (
            <View style={styles.card}>
              <Text style={styles.subtitle}>등록된 아이: {existing.name}</Text>
              <Text style={styles.body}>{existing.birthday}</Text>
              <ActionButton
                label="입력 대신 등록된 정보로 계속"
                variant="secondary"
                disabled={busy}
                onPress={() => void finish(existing)}
              />
              {editing ? (
                <ActionButton
                  label="입력 유지하고 다시 시도"
                  variant="secondary"
                  onPress={() => {
                    setExisting(null);
                    setBlocked(false);
                  }}
                />
              ) : null}
            </View>
          ) : null}
          {partial ? (
            <ActionButton
              label="선택 정보는 저장하지 않고 시작"
              variant="secondary"
              onPress={() => void finish(partial)}
            />
          ) : null}
          {savedResult ? (
            <ActionButton
              label="임시 입력 정리 다시 시도"
              variant="secondary"
              onPress={() => void finish(savedResult)}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
