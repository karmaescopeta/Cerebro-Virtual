# Build .exe: pyinstaller build.spec
# Result: dist/CerebroInstaller.exe
pyinstaller --onefile --windowed --name CerebroInstaller --add-data "index.html;." app.py
