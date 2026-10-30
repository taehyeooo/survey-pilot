// 응답 화면 개인정보 동의 안내(R-3, multi-user R-4). 화면과 테스트가 같은 문구를 쓴다.
export function consentNotes(contact: string | null) {
  return [
    "응답은 분석을 위해 Google Gemini로 처리돼요. 주관식에는 이름·연락처 같은 개인정보를 적지 말아 주세요. 이메일은 AI에 보내지 않아요.",
    "응답은 설문을 만든 사람이 봐요. 운영자는 응답 수만 봐요.",
    contact ? `응답 삭제 요청: ${contact}` : "응답 삭제는 설문을 보낸 사람에게 요청해 주세요.",
  ];
}
