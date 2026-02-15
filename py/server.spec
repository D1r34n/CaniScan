# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['desktop_server.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['flask', 'flask_cors', 'watchdog', 'watchdog.observers', 'watchdog.events', 'qrcode', 'PIL', 'socket', 'queue'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=['cv2'],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
