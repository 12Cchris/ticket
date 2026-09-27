// app.js 안의 APP_VERSION 값을 커맨드라인 인자로 받은 버전으로 바꿔치기한다.
// 사용법: node set-version.js 3.8.6

const fs = require("fs");
const path = require("path");

const version = process.argv[2];

if (!version) {
  console.error("사용법: node set-version.js <버전> (예: node set-version.js 3.8.6)");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("버전 형식이 올바르지 않습니다. major.minor.patch 형식으로 입력해주세요. 예: 3.8.6");
  process.exit(1);
}

const appPath = path.join(__dirname, "app.js");
let content = fs.readFileSync(appPath, "utf8");

const re = /var APP_VERSION = "[^"]*";/;
if (!re.test(content)) {
  console.error("app.js에서 APP_VERSION 선언을 찾지 못했습니다.");
  process.exit(1);
}

content = content.replace(re, 'var APP_VERSION = "' + version + '";');
fs.writeFileSync(appPath, content, "utf8");
console.log("app.js의 버전을 " + version + "(으)로 반영했습니다.");
