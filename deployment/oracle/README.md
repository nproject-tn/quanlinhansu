# Hướng dẫn từng bước: Chạy hệ thống trên Oracle Cloud dành cho người mới bắt đầu 🐢

Đừng lo lắng nếu bạn thấy quá nhiều thông tin kỹ thuật! Phần này mình sẽ hướng dẫn bạn thật chậm rãi, từng bước một, giống như cầm tay chỉ việc.

---

## Mở đầu: Về vấn đề Tên miền (Domain) miễn phí

Nếu bạn chưa có tên miền (như `ten-mien-cua-ban.com`), bạn không thể dùng được Cloudflare (bảo mật DDoS) một cách trọn vẹn. 
- **Cách 1 (Miễn phí 100%):** Dùng các dịch vụ cấp tên miền con miễn phí như **DuckDNS**. Bạn có thể tạo `apexflow.duckdns.org` và trỏ về địa chỉ IP của máy chủ Oracle. Nhược điểm: Không dùng được lớp giáp Cloudflare.
- **Cách 2 (Rẻ như cho - Khuyên dùng):** Mua 1 tên miền đuôi `.xyz` hoặc `.online`, `.site` trên các trang như Porkbun, Namecheap, Hostinger... Giá năm đầu tiên chỉ khoảng **1 đô la (khoảng 25.000 VNĐ)**. Dùng cách này bạn sẽ gắn được vào Cloudflare và mọi thứ cực kỳ chuyên nghiệp.
- **Cách 3 (Dùng tạm để test):** Cứ xài thẳng địa chỉ IP của máy chủ Oracle (Ví dụ: `http://123.45.67.89:3000`), khoan tính tới tên miền vội!

Bây giờ, chúng ta hãy tập trung vào việc **làm sao để máy ảo trên Oracle chạy được code của bạn**.

---

## Bước 1: Tạo máy chủ (Máy ảo) trên Oracle Cloud

1. Đăng nhập vào Oracle Cloud, tìm nút **"Create a VM instance"** (Tạo một máy ảo).
2. Đặt tên cho máy ảo (Ví dụ: `QuanLiNhanSu-Server`).
3. **Image and shape (Hệ điều hành và Cấu hình):**
   - Bấm *Edit*.
   - Mục Image: Chọn **Ubuntu 22.04**.
   - Mục Shape: Chọn **Ampere (ARM) A1 Compute**, kéo thanh RAM lên 24GB và CPU lên 4 OCPU (nếu nó báo hết tài nguyên thì giảm xuống 2 CPU / 12GB RAM).
4. **SSH Keys (Chìa khoá để mở cửa vào máy chủ):**
   - Chọn **"Save private key"**. Một file `.key` sẽ tải về máy tính của bạn. **Giữ file này cẩn thận vì mất nó là mất quyền vào máy chủ!**
5. Bấm nút **Create** ở dưới cùng.
6. Đợi 1-2 phút, màn hình sẽ hiện ra thông tin máy ảo của bạn. Hãy copy dãy số **Public IP Address** (Ví dụ: `150.12.34.56`).

---

## Bước 2: Kết nối vào máy chủ vừa tạo

Mở ứng dụng **Terminal** trên máy Mac của bạn.

1. Đầu tiên, cấp quyền bảo mật cho file chìa khoá mà bạn vừa tải về (giả sử nó nằm trong thư mục Downloads và tên là `ssh-key.key`):
   ```bash
   chmod 400 ~/Downloads/ssh-key.key
   ```
2. Dùng chìa khoá đó để kết nối (ssh) vào máy chủ:
   ```bash
   ssh -i ~/Downloads/ssh-key.key ubuntu@<ĐIỀN_IP_ORACLE_VÀO_ĐÂY>
   ```
3. Nếu Terminal hỏi `Are you sure you want to continue connecting (yes/no)?`, hãy gõ chữ `yes` và nhấn Enter. 
   *(Lúc này bạn đã chính thức bước vào bên trong máy tính của Oracle!)*

---

## Bước 3: Cài đặt Docker (Trái tim của hệ thống)

Vẫn trong cái bảng Terminal đang kết nối ở Bước 2, bạn dán lần lượt từng câu lệnh sau và nhấn Enter (chờ nó chạy xong lệnh này mới dán lệnh kia):

1. Cập nhật hệ thống:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
2. Cài Docker:
   ```bash
   sudo apt install -y docker.io docker-compose
   ```
3. Cấp quyền cho Docker:
   ```bash
   sudo usermod -aG docker $USER
   ```
4. Thoát ra để hệ thống nhận quyền mới:
   ```bash
   exit
   ```
*(Sau đó hãy kết nối lại bằng lệnh `ssh` ở Bước 2 nhé)*.

---

## Bước 4: Đưa code của bạn lên máy chủ Oracle

Đây là bước copy code từ máy Mac của bạn sang máy Oracle.

1. Bật 1 cửa sổ **Terminal MỚI** trên máy Mac của bạn (không phải cửa sổ đang kết nối với Oracle).
2. Nén toàn bộ dự án `ban-sao-quanlinhansu` của bạn thành 1 file ZIP (bạn có thể click chuột phải vào thư mục chọn Compress/Nén trên máy Mac).
3. Đẩy file nén đó sang Oracle bằng lệnh `scp`:
   ```bash
   scp -i ~/Downloads/ssh-key.key đường_dẫn_tới_file_zip.zip ubuntu@<ĐIỀN_IP_ORACLE_VÀO_ĐÂY>:/home/ubuntu/
   ```
4. Quay lại cửa sổ Terminal đang kết nối với Oracle, giải nén file đó ra:
   ```bash
   sudo apt install unzip
   unzip ten_file_vua_day_len.zip
   ```

---

## Bước 5: Ra lệnh cho hệ thống khởi động

Trên Terminal của Oracle, bạn hãy dùng lệnh `cd` để đi vào thư mục dự án vừa giải nén, sau đó đi tiếp vào thư mục `deployment/oracle`:
```bash
cd ban-sao-quanlinhansu/deployment/oracle
```

Tại đây, bạn gõ lệnh cuối cùng này để Docker làm toàn bộ phần việc còn lại:
```bash
docker-compose up -d --build
```

**Thế là xong phần cài đặt!**
Bây giờ, trên máy Oracle đã có 1 cơ sở dữ liệu riêng và ứng dụng của bạn.

---

## Phụ lục: Di chuyển dữ liệu từ Supabase sang (Làm sau khi đã chạy được hệ thống)

Bạn chỉ cần làm điều này trên Terminal máy Mac của bạn khi rảnh:

1. Rút dữ liệu từ Supabase ra thành 1 file `backup.dump`:
   ```bash
   pg_dump -h <HOST_CỦA_SUPABASE> -U postgres -d postgres -F c -f backup.dump
   ```
2. Đẩy file dữ liệu đó ngược vào Database ở máy Oracle:
   ```bash
   pg_restore -h <ĐIỀN_IP_ORACLE_VÀO_ĐÂY> -U postgres -d quanlinhansu -1 backup.dump
   ```
*(Lưu ý: Bạn phải mở cổng 5432 trên tường lửa của Oracle mới đẩy vào được).*
