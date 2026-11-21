# Imagem do laboratório com desktop gráfico (Xorg + Openbox) para o v86.
# Receita adaptada de copy/v86 tools/docker/alpine e tools/docker/debian.
# Construída somente no CI (veja scripts/build_gui.sh); nada daqui é versionado como binário.
FROM docker.io/i386/alpine:3.21.0

ENV KERNEL=virt

RUN apk add --no-cache openrc alpine-base agetty alpine-conf linux-$KERNEL linux-firmware-none \
    eudev xorg-server xf86-video-fbdev xf86-input-libinput xinit xsetroot \
    openbox xterm mousepad font-dejavu adwaita-icon-theme \
    bash coreutils findutils grep

# Usuário sem privilégios (o "agent" dos outros laboratórios) e root sem senha só dentro da VM
RUN adduser -D -s /bin/ash agent && passwd -d agent \
    && addgroup agent video && addgroup agent input && addgroup agent tty && addgroup agent dialout \
    && echo "root:" | chpasswd

# Login automático: tty1 vira o desktop; ttyS0 fica com um shell para diagnóstico/logs
RUN sed -i 's#^tty1::.*#tty1::respawn:/sbin/agetty --autologin agent --noclear tty1 linux#' /etc/inittab \
    && echo 'ttyS0::respawn:/sbin/agetty --autologin agent -s ttyS0 115200 vt100' >> /etc/inittab
RUN setup-hostname lab

# Serviços mínimos (mesma lista da receita do v86) + udev para o libinput achar teclado e mouse
RUN for i in devfs dmesg mdev hwdrivers; do rc-update add $i sysinit; done \
    && for i in hwclock modules sysctl hostname syslog bootmisc; do rc-update add $i boot; done \
    && rc-update add udev sysinit && rc-update add udev-trigger sysinit && rc-update add udev-settle sysinit \
    && rc-update add killprocs shutdown

# Xorg: driver fbdev (o v86 emula uma placa VGA/Bochs com framebuffer linear)
RUN mkdir -p /etc/X11/xorg.conf.d \
    && printf 'Section "Device"\n  Identifier "Card0"\n  Driver "fbdev"\nEndSection\n' > /etc/X11/xorg.conf.d/10-fbdev.conf \
    && printf 'needs_root_rights = yes\n' > /etc/X11/Xwrapper.config

# Desktop: fundo, um terminal e o Openbox; avisa o navegador pela serial quando estiver de pé
RUN printf '%s\n' \
    'xsetroot -solid "#1e2a38"' \
    'xterm -geometry 92x26+24+24 -fa "DejaVu Sans Mono" -fs 11 -bg black -fg "#d8dee9" &' \
    '(sleep 3; printf "\\nGUI_READY\\n" > /dev/ttyS0) &' \
    'exec openbox-session' > /home/agent/.xinitrc \
    && printf '%s\n' \
    'if [ -z "$DISPLAY" ] && [ "$(tty)" = /dev/tty1 ]; then exec startx -- -ac; fi' > /home/agent/.profile

# --- conteúdo do desafio (a flag é conferida por hash no navegador) ---
RUN mkdir -p /home/agent/Documentos /home/agent/.cache/relatorios \
    && printf 'Bem-vindo ao desktop do laboratório.\nO relatorio de incidentes do mes foi arquivado em uma pasta oculta.\nUse o terminal (xterm) ou o gerenciador de arquivos.\n' > /home/agent/Documentos/LEIA-ME.txt \
    && printf 'sem novidades\n' > /home/agent/.cache/relatorios/semana1.txt \
    && printf 'nota=%s\n' "$(printf 'FLAG{desktop_grafico_no_navegador}' | base64 | tr -d '\n')" > /home/agent/.cache/relatorios/incidente.b64 \
    && chown -R agent:agent /home/agent

# initramfs com os módulos de 9p/virtio, para montar a raiz via 9p (receita do v86)
RUN mkinitfs -F "base virtio 9p" $(cat /usr/share/kernel/$KERNEL/kernel.release)
