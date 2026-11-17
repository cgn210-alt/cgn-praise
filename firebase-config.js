// CGN 찬양팀 앱 Firebase 설정
// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)에 나오는 값을 그대로 붙여 넣으세요.
var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA-05e4Faq7kECxSVLfoM7O3xZGBUc_Klk",
  authDomain:        "cgn-praise.firebaseapp.com",
  databaseURL:       "https://cgn-praise-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "cgn-praise",
  storageBucket:     "cgn-praise.firebasestorage.app",
  messagingSenderId: "554893695234",
  appId:             "1:554893695234:web:83ddf40538060262718a1b"
};

// 가입을 허용할 회사 이메일 도메인 (database.rules.json 의 값과 같아야 합니다)
var ALLOWED_EMAIL_DOMAIN = "@cgnmail.net";

// 마스터 관리자 — 모든 권한을 갖고, 다른 관리자를 지정할 수 있습니다
// MASTER_EMAIL 은 database.rules.json 의 값과 같아야 합니다
var MASTER_EMAIL = "cgn210@cgnmail.net";
var MASTER_NAME  = "주웅현";
