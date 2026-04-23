# AGENTS.md (백엔드)

## 적용 범위
이 문서는 이 저장소(백엔드) 하위의 모든 파일에 적용된다.

## 작업 원칙
- 명시적 요청이 없으면 API 동작을 바꾸지 않는다.
- 큰 리팩터링보다 작고 안전한 변경을 우선한다.
- 기존 코드 스타일과 디렉토리 구조를 따른다.

## 기술 스택 (package.json 기준)
- Node.js + TypeScript `^5.7.3`
- NestJS
  - `@nestjs/common` `^11.0.1`
  - `@nestjs/core` `^11.0.1`
  - `@nestjs/platform-express` `^11.0.1`
  - `@nestjs/config` `^4.0.4`
  - `@nestjs/jwt` `^11.0.2`
  - `@nestjs/passport` `^11.0.5`
  - `@nestjs/typeorm` `^11.0.0`
- DB/ORM
  - `typeorm` `^0.3.28`
  - `mysql2` `^3.20.0`
  - `typeorm-naming-strategies` `^4.1.0`
- Validation/Transform
  - `class-validator` `^0.15.1`
  - `class-transformer` `^0.5.1`
- Auth
  - `passport` `^0.7.0`
  - `passport-jwt` `^4.0.1`
  - `bcrypt` `^6.0.0`
- Test
  - `jest` `^30.0.0`
  - `ts-jest` `^29.2.5`
  - `supertest` `^7.0.0`
- Lint/Format
  - `eslint` `^9.18.0`
  - `typescript-eslint` `^8.20.0`
  - `prettier` `^3.4.2`
  - `eslint-config-prettier` `^10.0.1`
  - `eslint-plugin-prettier` `^5.2.2`

## 코드 규칙
- 기존 모듈 구조(`src/<domain>`)를 유지한다.
- 공개 DTO 필드명은 마이그레이션 계획 없이 변경하지 않는다.
- 요청 DTO에는 `class-validator` 기반 검증을 적용한다.
- 비즈니스 로직을 수정하면 관련 단위 테스트를 추가/수정한다.
- 필요성이 명확하지 않으면 새 의존성을 추가하지 않는다.

## DB 규칙
- 기존 데이터를 파괴하는 변경은 피한다.
- 가능한 한 가산(추가) 방식 변경(컬럼/테이블 추가)을 우선한다.
- 스키마 변경 시 영향 범위와 롤백 방법을 작업 보고에 남긴다.

## API 규칙
- 응답 스펙 변경 시 관련 `controller`, `dto`, `service`, 테스트를 함께 수정한다.
- 가능하면 하위 호환성을 유지한다.

## 완료 전 확인 명령
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

## 금지 사항
- 명시적 요청 없이 파괴적 Git 명령(`git reset --hard`, `git checkout --`) 사용 금지
- `.env` 실제 값을 직접 수정하지 말고, 새 환경변수는 `.env.example`에 반영

## 결과 보고 형식
- 변경 파일과 동작 영향 요약
- 실행한 테스트/검증 명령과 결과
- 가정 사항과 후속 작업(있다면)
