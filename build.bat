@echo off

chcp 65001 >nul

cd /d "%~dp0"



echo [1/3] 단일 통합 index.html 빌드 중...

node -e "const fs=require('fs');if(fs.existsSync('dist')){fs.rmSync('dist',{recursive:true,force:true});}fs.mkdirSync('dist',{recursive:true});let h=fs.readFileSync('index.html','utf8');h=h.replace('<link rel=\"stylesheet\" href=\"styles.css\">','<style>\n'+fs.readFileSync('styles.css','utf8')+'\n</style>');h=h.replace('<script src=\"app.js\"></script>','<script>\n'+fs.readFileSync('app.js','utf8')+'\n</script>');fs.writeFileSync('dist/index.html',h,'utf8');"



if not exist "dist\index.html" (

    echo [오류] dist\index.html 빌드에 실패했습니다.

    goto END

)

echo [1/3] dist/index.html 빌드 완료!



echo.

echo [2/3] Git 변경사항 커밋 중...

git add -A

git diff --cached --quiet

if errorlevel 1 (

    git commit -m "Update ticket build"

) else (

    echo [안내] 변경된 내용이 없어 기존 상태를 유지합니다.

)



echo.

echo [3/3] GitHub (12Cchris/ticket)에 업로드(Push) 중...

git push origin main

if errorlevel 1 (

    echo.

    echo [오류] GitHub 푸시에 실패했습니다. 네트워크 또는 권한을 확인해주세요.

) else (

    echo.

    echo [완료] GitHub에 성공적으로 업로드되었습니다! (https://github.com/12Cchris/ticket)

)



:END

echo.

pause