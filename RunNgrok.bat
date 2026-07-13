@echo off
title UniVerse Ngrok Tunnel
echo Vui long chac chan ban da build Frontend bang cach chay "npm run build" trong thu muc client.
echo Dang khoi dong ngrok cho toan bo ung dung tai cong 5000...
ngrok start --all --config ngrok.yml
pause
