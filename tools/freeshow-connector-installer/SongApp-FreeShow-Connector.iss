#define AppName "SongApp FreeShow Connector"
#define AppVersion "1.0.0"
#define AppPublisher "SongApp BCBgiroc"

[Setup]
AppId={{D69424CF-451F-477B-AD31-F65B1A787A42}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\SongApp FreeShow Connector
DefaultGroupName=SongApp FreeShow
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\..\public\downloads
OutputBaseFilename=SongApp-FreeShow-Connector-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName={#AppName}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "romanian"; MessagesFile: "Romanian.isl"

[Tasks]
Name: "autostart"; Description: "Pornește automat conectorul odată cu Windows"; GroupDescription: "Pornire automată:"; Flags: checkedonce
Name: "desktopicon"; Description: "Creează o scurtătură pe Desktop"; GroupDescription: "Scurtături suplimentare:"; Flags: unchecked

[Files]
Source: "..\freeshow-connector\connector.mjs"; DestDir: "{app}"; Flags: ignoreversion
Source: "Start-Connector.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Stop-Connector.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "CITESTE-MAI-INTAI-EXE.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Porneste conectorul"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\Start-Connector.ps1"""; WorkingDir: "{app}"
Name: "{group}\Opreste conectorul"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\Stop-Connector.ps1"""; WorkingDir: "{app}"
Name: "{group}\Dezinstaleaza conectorul"; Filename: "{uninstallexe}"
Name: "{autodesktop}\SongApp FreeShow Connector"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\Start-Connector.ps1"""; WorkingDir: "{app}"; Tasks: desktopicon

[Registry]
Root: HKA; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "SongAppFreeShowConnector"; ValueData: """{sys}\WindowsPowerShell\v1.0\powershell.exe"" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\Start-Connector.ps1"""; Flags: uninsdeletevalue; Tasks: autostart

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\Start-Connector.ps1"""; Description: "Pornește acum conectorul FreeShow"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\Stop-Connector.ps1"""; Flags: runhidden; RunOnceId: "StopConnector"

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if not FileExists(ExpandConstant('{pf}\nodejs\node.exe')) and
     not FileExists(ExpandConstant('{localappdata}\Programs\nodejs\node.exe')) then
  begin
    if MsgBox('Conectorul necesită Node.js LTS. Dacă Node.js nu este deja instalat, descarcă Windows Installer de pe site-ul oficial. Dorești să deschizi pagina acum?', mbConfirmation, MB_YESNO) = IDYES then
      ShellExec('open', 'https://nodejs.org/en/download/', '', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
  end;
end;
