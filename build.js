// dist/index.html 빌드 스크립트
// index.html에 styles.css / vendor/html2canvas.min.js / app.js 내용을 그대로 인라인해서
// "인터넷 연결 없이도 열리는" 단일 HTML 파일 하나로 합친다.
// (Galmuri14 폰트는 styles.css 안에 base64로 이미 내장되어 있어 별도 처리가 필요 없음)

const fs = require("fs");
const path = require("path");

const root = __dirname;
const distDir = path.join(root, "dist");

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");

html = html.replace(
  '<link rel="stylesheet" href="styles.css">',
  "<style>\n" + fs.readFileSync(path.join(root, "styles.css"), "utf8") + "\n</style>"
);

html = html.replace(
  '<script src="vendor/html2canvas.min.js"></script>',
  "<script>\n" + fs.readFileSync(path.join(root, "vendor", "html2canvas.min.js"), "utf8") + "\n</script>"
);

html = html.replace(
  '<script src="app.js"></script>',
  "<script>\n" + fs.readFileSync(path.join(root, "app.js"), "utf8") + "\n</script>"
);

if (html.indexOf("vendor/html2canvas.min.js") !== -1) {
  console.error("[오류] vendor/html2canvas.min.js 인라인에 실패했습니다. (vendor 폴더 확인 필요)");
  process.exit(1);
}

fs.writeFileSync(path.join(distDir, "index.html"), html, "utf8");
console.log("dist/index.html 빌드 완료 (외부 CDN 의존 없이 완전히 하나의 파일로 통합됨)");
