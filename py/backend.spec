# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[('.env', '.'), ('..\\runs\\v8\\n\\train_results2\\weights\\best.pt', 'runs\\v8\\n\\train_results2\\weights'), ('..\\runs\\11\\n\\train_results\\weights\\best.pt', 'runs\\11\\n\\train_results\\weights')],
    hiddenimports=['llm_service', 'ultralytics.models.yolo', 'ultralytics.nn.tasks', 'ultralytics.engine.model', 'langchain_core', 'langchain_ollama'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pytest', 'matplotlib', 'pandas', 'scipy', 'sklearn', 'tkinter', 'PyQt5', 'notebook', 'jupyter'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend',
)
