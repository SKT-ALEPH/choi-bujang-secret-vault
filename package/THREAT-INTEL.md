# 공식 침해 정보와 버전 대조

확인일: 2026-10-27. 구현: `api/threat-intel.js`, `src/threat-intel.mjs`. 공식 [NVD API](https://nvd.nist.gov/developers/vulnerabilities)와 [CISA KEV JSON](https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json)을 실제 수신했다. HTTPS 검증은 유지했다. 로컬 Node는 OS 인증서 저장소를 사용하는 `--use-system-ca`로 검증했으며 TLS 검사를 끄지 않았다.

NVD는 고정 공개 검색어·페이지당50건·최대40페이지다. 총 결과·현재 시작점·조회/표시 건수·다음 페이지를 표시한다. 검색 결과에는 동명 제품·작성자 이름·연관 앱도 포함된다. KEV는 전체 JSON의 CVE ID와 정확히 대조하고 원천의 공표 시각과 실제 받은 시각을 별도로 표시한다. 각 원천의 실제 성공 수신 시각을 서비스 전용 DB에 보존하고6시간 재사용한다. 실패한 갱신으로 시각을 새로 쓰거나0건을 반환하지 않는다.

## 현재 구성의 버전 출처

| 구성요소 | 선언 버전 | 코드 출처 | 판단 범위 |
|---|---|---|---|
| Node.js |24.19.0|`on-client/package.json`의 정확한 실행 조건|PC용 선언 버전. Vercel 실제 런타임 버전과 혼동하지 않음 |
| jose |6.2.12|`package-lock.json`|현재 잠금 의존성 |
| Supabase JS |2.117.2|`package-lock.json`|SDK 버전. 서버 DB 엔진 버전과 다름 |
| esbuild |0.28.2|`package-lock.json`|빌드 도구. NVD의 다른 제품 사례를 이 도구의 취약점으로 단정하지 않음 |
| Wazuh |4.14.9|공식 agent/manager 설치의 고정 버전|설치 스크립트와 기존 실제 설치 기록 대조 |

자동 버전 비교는 정확히 일치하는 vendor/product CPE의 단순 OR·숫자 버전 범위만 처리한다. AND 환경 조건·negate·복잡 CPE·타 제품·불명 버전은 **수동 검토**다. 상태는 `version_range_match`(범위 일치), `outside_listed_ranges`(그 기록의 범위 밖), `needs_review`(수동 확인)이며 ‘안전’ 상태는 없다. 페이지0건, 범위 밖, KEV 미등재 모두 전체 취약점 부재를 증명하지 않는다.

## 실제 수신 기록의 수동 대조

| 구성·기록 | 공식 내용과 현재 버전의 관계 | 대응·한계 |
|---|---|---|
| Wazuh4.14.9 / [CVE-2025-24016](https://nvd.nist.gov/vuln/detail/CVE-2025-24016) | 실제 KEV ID 일치. 수신 NVD 설명은4.4.0 이상4.9.1 미만을 영향 범위로 제시 | 선언4.14.9는 그 범위 밖. 실제 설치/manager/API 노출을 별도로 확인하며 이 한 건으로 Wazuh 전체의 안전을 선언하지 않음 |
| jose6.2.12 / [CVE-2021-29443](https://nvd.nist.gov/vuln/detail/CVE-2021-29443) | 수신 설명의 수정 버전1.28.1·2.0.5·3.11.4와 대조하면 해당 구버전 범위 밖 | 코드의 JWT/JWE 사용 조건과 공급자 권고를 확인. 동명 JOSE 라이브러리/작성자 이름으로 검색된 결과는 자동 영향 판정에서 제외 |
| esbuild0.28.2 / [CVE-2026-11417](https://nvd.nist.gov/vuln/detail/CVE-2026-11417), [CVE-2026-44594](https://nvd.nist.gov/vuln/detail/CVE-2026-44594) | 검색 결과 설명의 제품은 aws-cdk-lib 및 esm.sh로 esbuild 자체와 다름 | 자동 비교는 수동 확인으로 남김. 이 목록만으로 esbuild의 모든 취약점을 확인했다고 하지 않음. 기존 OSV 조회와 서로 보완 |
| Supabase JS2.117.2 / 검색어supabase | 수신43건에는 Supabase를 사용하는 타 앱 기록이 포함 | 검색어 일치만으로 SDK 영향 확정/전체 안전 판정 금지 |
| Node24.19.0 / 검색어node.js | 실제 첫50건과 마지막 페이지16건 수신. 전체1216건 | 전체24페이지를 모두 검토한 결과가 아님. UI의 현재 페이지/검색 한계와 함께 사용 |

공식 원천 실조회와 배포 API 실연동은 다른 증거다. 재수신 시 총건수·KEV catalogue·시각은 바뀔 수 있으며 현재 UI가 실제로 받은 시각을 기준으로 한다. 배포 API의 수신/캐시/버전 표시 증빙은 [SELF-CHECK P5](SELF-CHECK.md)에 기록한다.
