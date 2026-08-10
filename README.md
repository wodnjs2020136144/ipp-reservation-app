# ipp-reservation-app (CNSE Works)

충남교육청 과학교육원 현장 운영진을 위한 Expo/React Native 앱입니다. 프로그램 예약 현황 확인, AI 예약 비서 챗봇, 교구 재고 관리, 근무자 구역 로테이션 스케줄 기능을 제공합니다.

예약 데이터와 AI 챗봇은 [`ipp-reservation-server`](../ipp-reservation-server) 리포지토리의 백엔드에서 제공됩니다.

## 스크린샷

iOS 시뮬레이터(Expo Go)에서 확인한 4개 탭 화면입니다.

| 예약 확인 | AI 비서 | 교구 관리 | 스케줄 |
|---|---|---|---|
| ![예약 확인](docs/screenshots/home.png) | ![AI 비서](docs/screenshots/ai-chat.png) | ![교구 관리](docs/screenshots/kits.png) | ![스케줄](docs/screenshots/schedule.png) |

## 기술 스택

- **프레임워크**: Expo SDK 53 / React Native 0.79.5 / React 19
- **내비게이션**: React Navigation (bottom-tabs + native-stack)
- **백엔드 연동**: `fetch` (REST, `ipp-reservation-server`) + Firebase (Firestore, 익명 Auth)
- **로컬 저장소**: `@react-native-async-storage/async-storage`
- 네이티브 프로젝트(`ios/`, `android/`)가 이미 생성된 **prebuild(bare workflow) 상태**입니다.

## 폴더 구조

```
App.js                    진입점 — Firebase 익명 로그인 게이트, 탭 내비게이션 구성
firebase.js                Firebase 앱/Firestore/Auth 초기화
screens/
  HomeScreen.js             예약 현황 대시보드 (1분 폴링)
  AiChatScreen.js           AI 예약 비서 챗봇 (서버 /api/chat 직접 호출)
  KitsScreen.js             교구 재고/수리 관리 (Firestore 실시간 구독)
  ScheduleScreen.js         근무자 구역 자동 로테이션 캘린더
components/
  ReservationItem.js        예약 슬롯 표시 공용 컴포넌트
  LoadingView.js             전체 화면 로딩 스피너 공용 컴포넌트
constants/
  theme.js                   화면 공용 색상 팔레트
services/
  api.js                    예약 서버 REST 클라이언트
  kitService.js              Firestore kits/logs CRUD
  scheduleService.js         Firestore 스케줄 설정 CRUD
  dummyData.js                초기 시드 데이터
```

## 시작하기

### 요구 사항
- Node.js, npm/yarn
- Expo CLI (`npx expo`)
- Firebase 프로젝트 (Firestore + Anonymous Auth 활성화 필요)

### 설치
```bash
npm install
```

### 환경변수
`.env.example`을 복사해 `.env`를 만듭니다. 모든 값이 선택 사항이며, 비워두면 `firebase.js`/`services/api.js`에 내장된 기본값(현재 운영 중인 프로젝트)을 사용합니다.
```bash
cp .env.example .env
```

| 변수명 | 설명 |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | 예약 서버 REST API 주소 |
| `EXPO_PUBLIC_FIREBASE_*` | 다른 Firebase 프로젝트(개발/스테이징 등)로 연결할 때만 설정 |

### Firebase 설정
Firestore에는 다음 컬렉션/문서가 사용되며, 접근 권한은 `firestore.rules`에 정의되어 있습니다(익명 인증 로그인 사용자만 read/write 가능, `firebase deploy --only firestore:rules`로 배포).

- `kits` 컬렉션 — 교구 목록
- `logs/kitLogs` 문서 — 교구 변경 이력
- `settings/scheduleConfig` 문서 — 근무자/스케줄 설정

### 로컬 실행
```bash
npx expo start
```
- 예약/AI 챗봇 기능을 테스트하려면 `ipp-reservation-server`가 실행 중이어야 합니다(기본값은 배포된 `https://ipp-reservation-server.fly.dev`).
- 네이티브 코드 변경이 필요한 경우 `npm run ios` / `npm run android`로 prebuild된 네이티브 프로젝트를 직접 빌드합니다.
- 최신 Xcode(26.x)에서 iOS 네이티브 빌드가 `fmt`(RCT-Folly 번들) 관련 컴파일 에러로 실패하는 경우, 아래 "알려진 이슈"를 참고하세요. 그런 환경에서는 `npx expo start --go`로 Expo Go 시뮬레이터 확인이 대안입니다.

### 빌드/배포 (EAS)
`eas.json`에 `development`/`preview`/`production` 3개 프로필이 정의되어 있습니다.
```bash
eas build --profile preview
```

## 주요 화면

| 탭 | 화면 | 설명 |
|---|---|---|
| 예약 확인 | `HomeScreen` | IPP / 과학해설사 그룹별 오늘 예약 현황을 카드로 표시, 1분 자동 새로고침, cnse.or.kr 공식 예약 페이지 링크 제공 |
| AI 비서 | `AiChatScreen` | 서버의 Gemini 기반 챗봇과 대화하며 예약 현황을 자연어로 질의 |
| 교구 관리 | `KitsScreen` | 교구 수량 증감, 수리중 토글, 메모, 변경 이력(페이지네이션) — Firestore 실시간 반영 |
| Schedule | `ScheduleScreen` | 3명 근무자의 구역(인공지능배움터/VR체험/로봇배움터)을 평일 카운트 기반으로 자동 로테이션 계산, 공휴일/월차 반영, 수동 오버라이드 가능 |

## 알려진 이슈 및 개선 필요 사항

코드 리뷰를 통해 확인된 항목입니다. 보안 우선 개선 로드맵에 따라 순차적으로 해결 중입니다.

### 해결 완료
| 항목 | 조치 |
|---|---|
| Firestore 보안 규칙 파일 부재 | `firestore.rules` 작성 및 `firebase deploy --only firestore:rules`로 배포 완료. `kits`/`logs`/`settings` 경로만 익명 인증 로그인 사용자에게 열고 나머지는 기본 차단 |
| `BASE_URL` 중복 하드코딩 | `services/api.js`에서 `export const BASE_URL`로 단일화, `AiChatScreen.js`는 이를 import해서 사용. `EXPO_PUBLIC_API_BASE_URL` 환경변수로 오버라이드 가능 |
| Firebase 설정 미환경변수화 | `EXPO_PUBLIC_FIREBASE_*` 환경변수로 오버라이드 가능하게 변경(값이 없으면 기존 기본값 사용, 기존 동작 유지) |
| `ScheduleScreen` AsyncStorage/Firestore 동기화 경합 조건 | onSnapshot을 원격 데이터의 단일 소스로 삼아 AsyncStorage 쓰기를 한 곳으로 통합. 마운트 시 로컬 캐시를 먼저 읽어 즉시 화면을 채우고 이후 Firestore 값으로 갱신 |
| `dayjs`/`@expo/vector-icons` 미선언, `axios` 미사용 의존성 | `package.json`에 dayjs/@expo/vector-icons 명시, axios 제거 |

### 해결 완료 (계속)
| 항목 | 조치 |
|---|---|
| `HOLIDAYS`가 2025년 하반기까지만 존재 | 2026년 법정공휴일/대체공휴일 전체 추가, 매년 갱신 필요하다는 TODO 주석 추가 |
| `context/KitContext.js` 빈 파일, `zones`/`isHoliday` 죽은 코드 | 모두 삭제 |
| `firebase.js` 디버그 `console.log` | 제거 |

### 해결 완료 (계속)
| 항목 | 조치 |
|---|---|
| fetch 타임아웃 부재 | `services/api.js`에 `fetchWithTimeout`(AbortController 기반) 추가, 예약 조회 15초/AI 챗봇 30초 |
| 예약 화면에서 "데이터 없음"과 "서버 오류"를 구분 못함 | `fetchAllReservations`가 `fetchError` 플래그를 반환, `HomeScreen`에 서버 연결 실패 안내 배너 추가 |
| `COLORS`/로딩 뷰/모달 wrapper 중복 | `constants/theme.js`(팔레트), `components/LoadingView.js`(로딩 뷰), `ScheduleScreen`의 `ScheduleModal`(모달 wrapper)로 통합. 통합 과정에서 HomeScreen이 참조만 하고 정의는 없던 `COLORS.accentLight`(예약하기 버튼 배경, 값이 `undefined`였음) 버그도 함께 수정 |
| `START_DATE`/`START_MONTH` 매직값 | 로테이션 계산 기준일임을 설명하는 주석 추가 |

이로써 코드 리뷰에서 발견된 항목이 모두 해결되었습니다.

### 남은 이슈 (환경 이슈)
| 심각도 | 항목 | 위치 |
|---|---|---|
| 중간 | 최신 Xcode(26.6 확인됨)에서 iOS 네이티브 빌드가 `fmt`(RCT-Folly 번들)의 `FMT_STRING()` 매크로가 생성하는 consteval 생성자에서 "call to consteval function ... is not a constant expression" 에러로 실패함. 앱 코드가 아닌 fmt 라이브러리 자체 코드에서 발생하며, `FMT_CONSTEVAL`/`FMT_USE_CONSTEVAL` 매크로 오버라이드로도 해결 안 됨(원인과 시도한 방법은 `ios/Podfile` 주석 참고). Expo/React Native 업그레이드로 fmt 버전이 올라가면 해결될 가능성이 높음. 그 전까지는 `npx expo start --go`(Expo Go)로 시뮬레이터 확인 가능 | `ios/Podfile` |
