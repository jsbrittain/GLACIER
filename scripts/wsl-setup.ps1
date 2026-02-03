#!/usr/bin/env pwsh

wsl.exe --version
wsl.exe --list

mkdir "$env:USERPROFILE\glacier\wsl" -Force
curl.exe -L "https://cloud-images.ubuntu.com/releases/jammy/release/ubuntu-22.04-server-cloudimg-amd64-root.tar.xz" -o "$env:USERPROFILE\glacier\wsl\ubuntu-22.04.tar.xz"

wsl.exe --import build "$env:USERPROFILE\glacier\wsl" "$env:USERPROFILE\glacier\wsl\ubuntu-22.04.tar.xz"

wsl.exe -d build -u root -- apt update
wsl.exe -d build -u root -- apt upgrade -y
wsl.exe -d build -u root -- apt install -y docker.io openjdk-17-jre-headless
wsl.exe -d build -u root -- java -version

wsl.exe -d build -u root -- useradd -m -s /bin/bash user
wsl.exe -d build -u root -- bash -c "echo 'user:user' | chpasswd"
wsl.exe -d build -u root -- bash -c "echo -e '[boot]\nsystemd=true\n[user]\ndefault=user' > /etc/wsl.conf"
wsl.exe -d build -u root -- usermod -aG docker user
wsl.exe -d build -u root -- bash -c "sed -i 's/127.0.1.1.*/127.0.1.1 glacier/' /etc/hosts"

wsl.exe -t build
wsl.exe -d build -u root -- systemctl enable docker
wsl.exe -d build -u root -- systemctl start docker
wsl.exe -d build -u user -- bash -c "curl -s https://get.nextflow.io -o ~/nextflow && chmod +x ~/nextflow"
wsl.exe -d build -u root -- mv /home/user/nextflow /usr/local/bin/

wsl.exe -t build

wsl.exe -d build -- nextflow -v
wsl.exe -d build -- nextflow run hello
wsl.exe -d build -- docker run hello-world

wsl.exe -t build
wsl.exe --export build "$env:USERPROFILE\glacier\wsl\glacier-wsl.tar"
wsl.exe --unregister build

wsl.exe --import glacier "$env:USERPROFILE\glacier\wsl" "$env:USERPROFILE\glacier\wsl\glacier-wsl.tar"

wsl.exe -d glacier -- nextflow -v
wsl.exe -d glacier -- nextflow run hello
wsl.exe -d glacier -- docker run hello-world
