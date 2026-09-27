// app.js 안의 APP_VERSION 값만 콘솔에 출력한다. (commit.bat에서 현재 버전을 읽어올 때 사용)
const fs = require("fs");
const path = require("path");

const content = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const m = content.match(/APP_VERSION = "([^"]+)"/);
console.log(m ? m[1] : "");
