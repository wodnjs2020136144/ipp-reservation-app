/**
 * constants/theme.js — 화면 공용 색상 팔레트
 *
 * 기존에는 HomeScreen/KitsScreen/ScheduleScreen이 거의 동일한 COLORS 객체를
 * 각자 파일에 중복 정의하고 있었다(값은 전부 동일했고, 사용하는 키만 화면마다
 * 조금씩 달랐음). 이를 하나로 합쳐 유지보수 시 한 곳만 수정하면 되도록 함.
 *
 * 참고: HomeScreen에서 COLORS.accentLight를 참조하고 있었지만 로컬 COLORS
 * 객체에는 정의되어 있지 않아 실제로는 undefined였다(예약 카드의 "예약하기"
 * 버튼 배경). 이 통합 과정에서 값이 채워져 함께 수정됨.
 */
export const COLORS = {
  primary: '#0F172A',       // Slate 900
  primaryLight: '#475569',  // Slate 600
  secondary: '#475569',     // primaryLight와 동일 값의 별칭(HomeScreen 호환용)
  accent: '#007AFF',        // Blue
  accentLight: '#E0F2FE',   // Light Blue
  accentGradient: ['#007AFF', '#0051A8'],
  danger: '#EF4444',        // Red
  dangerLight: '#FEE2E2',   // Light Red
  success: '#10B981',       // Green
  successLight: '#D1FAE5',  // Light Green
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
};
