#!/bin/bash
# Script tự động đẩy code lên Oracle Cloud

echo "📦 Đang nén code..."
# Xoá file zip cũ nếu có
rm -f /tmp/quanlinhansu.zip

# Nén toàn bộ code hiện tại (bỏ qua các thư mục nặng không cần thiết)
zip -r /tmp/quanlinhansu.zip . -x "node_modules/*" -x ".next/*" -x ".git/*" -q

echo "🚀 Đang tải lên Oracle Cloud (Vui lòng đợi vài phút tuỳ tốc độ mạng)..."
scp -i ~/Downloads/ssh-key-2026-07-21.key -o StrictHostKeyChecking=no /tmp/quanlinhansu.zip ubuntu@140.245.105.160:~

echo "✅ Tải lên thành công! File quanlinhansu.zip đã nằm trong máy chủ Oracle."
