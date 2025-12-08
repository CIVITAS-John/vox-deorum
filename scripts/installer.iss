; Vox Deorum Installer Script for Inno Setup
; This script bundles all necessary files including portable Node.js

; Read version from release.txt
#define MyAppVersion "0.2.1"

#define MyAppName "Vox Deorum"
#define MyAppPublisher "John Chen"
#define MyAppURL "https://github.com/CIVITAS-John/vox-deorum"

[Setup]
; Application metadata
AppId={{E8C5A2B3-4D7F-4A89-9C2E-1B3F5D8A7E9C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
; Output settings
OutputDir=dist
OutputBaseFilename=VoxDeorumSetup_{#MyAppVersion}
SetupIconFile=vox-deorum.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; No admin rights required - install to user folder
PrivilegesRequired=lowest
; Minimum Windows version (Windows 10)
MinVersion=10.0
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\scripts\vox-deorum.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
BeveledLabel={#MyAppName} {#MyAppVersion} - LLM-Enhanced AI for Civilization V

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "configureapi"; Description: "Open API configuration after installation"; GroupDescription: "Configuration"

[Files]
; Root-level package.json for centralized dependencies
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\package-lock.json"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

; Core application files (without node_modules)
Source: "..\bridge-service\*"; DestDir: "{app}\bridge-service"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".git,*.log,node_modules\*"
Source: "..\mcp-server\*"; DestDir: "{app}\mcp-server"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".git,*.log,node_modules\*"
Source: "..\vox-agents\*"; DestDir: "{app}\vox-agents"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".git,*.log,node_modules\*,.env"

; Civ5 mod files
Source: "..\civ5-mod\*"; DestDir: "{app}\civ5-mod"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\civ5-dll\(1) Community Patch\*"; DestDir: "{app}\civ5-dll\(1) Community Patch"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\civ5-dll\(2) Vox Populi\*"; DestDir: "{app}\civ5-dll\(2) Vox Populi"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\civ5-dll\(3a) EUI Compatibility Files\*"; DestDir: "{app}\civ5-dll\(3a) EUI Compatibility Files"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\civ5-dll\VPUI\*"; DestDir: "{app}\civ5-dll\VPUI"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\civ5-dll\UI_bc1\*"; DestDir: "{app}\civ5-dll\UI_bc1"; Flags: ignoreversion recursesubdirs createallsubdirs

; Pre-built DLLs (with both release and debug versions)
Source: "release\CvGameCore_Expansion2.dll"; DestDir: "{app}\scripts\release"; Flags: ignoreversion
Source: "release\CvGameCore_Expansion2.pdb"; DestDir: "{app}\scripts\release"; Flags: ignoreversion skipifsourcedoesntexist
Source: "release\lua51_win32.dll"; DestDir: "{app}\scripts\release"; Flags: ignoreversion
Source: "release\lua51_win32.pdb"; DestDir: "{app}\scripts\release"; Flags: ignoreversion skipifsourcedoesntexist
Source: "debug\CvGameCore_Expansion2.dll"; DestDir: "{app}\scripts\debug"; Flags: ignoreversion skipifsourcedoesntexist
Source: "debug\CvGameCore_Expansion2.pdb"; DestDir: "{app}\scripts\debug"; Flags: ignoreversion skipifsourcedoesntexist
Source: "debug\lua51_win32.dll"; DestDir: "{app}\scripts\debug"; Flags: ignoreversion skipifsourcedoesntexist
Source: "debug\lua51_win32.pdb"; DestDir: "{app}\scripts\debug"; Flags: ignoreversion skipifsourcedoesntexist

; Scripts and configuration (excluding installer files)
Source: "*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "installer.iss,build-installer.cmd,post-install.cmd"
Source: "..\release.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion

; Portable Node.js (required - downloaded by build-installer.cmd)
Source: "..\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
; Node modules installed at root level with workspaces
Source: "..\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

; Default .env file for vox-agents
Source: "..\vox-agents\.env.default"; DestDir: "{app}\vox-agents"; Flags: ignoreversion

; Configuration files for game
Source: "configs\config.ini"; DestDir: "{app}\scripts\configs"; Flags: ignoreversion skipifsourcedoesntexist
Source: "configs\UserSettings.ini"; DestDir: "{app}\scripts\configs"; Flags: ignoreversion skipifsourcedoesntexist

[Dirs]
Name: "{app}\bridge-service"
Name: "{app}\mcp-server"
Name: "{app}\vox-agents"
Name: "{app}\scripts"
Name: "{app}\node"

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\scripts\vox-deorum.cmd"; IconFilename: "{app}\scripts\vox-deorum.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\scripts\vox-deorum.cmd"; IconFilename: "{app}\scripts\vox-deorum.ico"; Tasks: desktopicon
Name: "{autodesktop}\{#MyAppName} Configuration"; Filename: "notepad.exe"; Parameters: "{app}\vox-agents\.env"; IconFilename: "{app}\scripts\vox-deorum.ico"; Tasks: desktopicon

; [Registry] section removed - no PATH modification needed since we use portable Node.js

[Run]
; Open configuration file if task selected
Filename: "notepad.exe"; Parameters: "{app}\vox-agents\.env"; Description: "Configure API keys"; Flags: postinstall nowait skipifsilent; Tasks: configureapi

[UninstallRun]
; Clean up mods on uninstall
Filename: "{app}\scripts\uninstall-mods.cmd"; Flags: runhidden

[Code]
var
  InfoPage: TOutputMsgWizardPage;
  Civ5DirPage: TInputDirWizardPage;
  SteamPath: String;
  Civ5Path: String;
  ModsPath: String;

function FindCiv5Installation(): String;
var
  PossiblePaths: array[0..10] of String;
  i: Integer;
begin
  Result := '';

  // First, find Steam installation path (check user registry first for non-admin mode)
  if not RegQueryStringValue(HKEY_CURRENT_USER, 'Software\Valve\Steam', 'SteamPath', SteamPath) then
  begin
    // Try common default locations without requiring admin access
    if DirExists('C:\Program Files (x86)\Steam') then
      SteamPath := 'C:\Program Files (x86)\Steam'
    else if DirExists('C:\Program Files\Steam') then
      SteamPath := 'C:\Program Files\Steam'
    else if DirExists(ExpandConstant('{localappdata}\Steam')) then
      SteamPath := ExpandConstant('{localappdata}\Steam')
    else if DirExists(ExpandConstant('{userappdata}\Steam')) then
      SteamPath := ExpandConstant('{userappdata}\Steam');
  end;

  // Convert forward slashes to backslashes in Steam path
  StringChangeEx(SteamPath, '/', '\', True);

  // Build list of possible installation paths
  PossiblePaths[0] := SteamPath + '\steamapps\common\Sid Meier''s Civilization V';
  PossiblePaths[1] := 'C:\SteamLibrary\steamapps\common\Sid Meier''s Civilization V';
  PossiblePaths[2] := 'D:\SteamLibrary\steamapps\common\Sid Meier''s Civilization V';
  PossiblePaths[3] := 'E:\SteamLibrary\steamapps\common\Sid Meier''s Civilization V';
  PossiblePaths[4] := 'F:\SteamLibrary\steamapps\common\Sid Meier''s Civilization V';
  PossiblePaths[5] := 'G:\SteamLibrary\steamapps\common\Sid Meier''s Civilization V';
  PossiblePaths[6] := 'C:\Games\Steam\steamapps\common\Sid Meier''s Civilization V';
  PossiblePaths[7] := 'D:\Games\Steam\steamapps\common\Sid Meier''s Civilization V';
  PossiblePaths[8] := 'C:\Program Files (x86)\Steam\steamapps\common\Sid Meier''s Civilization V';
  PossiblePaths[9] := 'C:\Program Files\Steam\steamapps\common\Sid Meier''s Civilization V';
  PossiblePaths[10] := 'D:\Steam\steamapps\common\Sid Meier''s Civilization V';

  // Check each possible path for CivilizationV.exe
  for i := 0 to 10 do
  begin
    if FileExists(PossiblePaths[i] + '\CivilizationV.exe') then
    begin
      Result := PossiblePaths[i];
      Exit;
    end;
  end;

  // Also check for appmanifest_8930.acf (Civ5's Steam App ID)
  if SteamPath <> '' then
  begin
    if FileExists(SteamPath + '\steamapps\appmanifest_8930.acf') then
    begin
      // Civ5 is installed in main Steam library
      Result := SteamPath + '\steamapps\common\Sid Meier''s Civilization V';
    end;
  end;
end;

procedure InitializeWizard;
var
  DetectedPath: String;
  ProjectInfo: String;
begin
  // Create information page about the project
  ProjectInfo := 'Vox Deorum brings modern AI capabilities to Civilization V, allowing you to ' +
                 'play alongside or against AI opponents powered by large language models (LLMs) ' +
                 'like GPT, Claude, and Gemini.' + #13#10#13#10 +

                 'WHAT IT DOES:' + #13#10 +
                 '• AI observes the game state in real-time' + #13#10 +
                 '• Makes strategic decisions using your chosen LLM' + #13#10 +
                 '• Directs in-game AI behaviors and diplomacy' + #13#10 +
                 '• Supports both interactive play and AI-only observation' + #13#10#13#10 +

                 'REQUIREMENTS:' + #13#10 +
                 '• Civilization V (Complete Edition recommended)' + #13#10 +
                 '• Vox Populi (Bundled for now)' + #13#10 +
                 '• API key from OpenRouter, OpenAI, or Google AI' + #13#10#13#10 +

                 'Built upon the Community Patch / Vox Populi.' +
                 'LICENSE: GPL (Vox Populi) + CC BY-NC-SA 4.0 (Vox Deorum)';

  InfoPage := CreateOutputMsgPage(wpWelcome,
    'About Vox Deorum',
    'LLM-Enhanced AI for Civilization V',
    ProjectInfo);

  // Try to auto-detect Civilization V installation
  DetectedPath := FindCiv5Installation();

  // Create the directory selection page with detection status
  if DetectedPath <> '' then
  begin
    Civ5DirPage := CreateInputDirPage(wpSelectTasks,
      'Select Civilization V Installation',
      'Where is Civilization V installed?',
      'Vox Deorum requires Civilization V to be installed. Please select the folder where ' +
      'Civilization V is installed. The installer will copy the required mods and DLLs to this location.' + #13#10#13#10 +
      'The installer has detected your Civilization V installation.',
      False, '');
  end
  else
  begin
    Civ5DirPage := CreateInputDirPage(wpSelectTasks,
      'Select Civilization V Installation',
      'Where is Civilization V installed?',
      'Vox Deorum requires Civilization V to be installed. Please select the folder where ' +
      'Civilization V is installed. The installer will copy the required mods and DLLs to this location.' + #13#10#13#10 +
      'The installer has NOT detected Civilization V. Please browse to the correct folder.',
      False, '');
  end;

  // Add the browse item with detected or default path
  Civ5DirPage.Add('Civilization V installation folder:');
  if DetectedPath <> '' then
  begin
    Civ5DirPage.Values[0] := DetectedPath;
  end
  else
  begin
    Civ5DirPage.Values[0] := 'C:\Program Files (x86)\Steam\steamapps\common\Sid Meier''s Civilization V';
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = Civ5DirPage.ID then
  begin
    // Validate the selected Civilization V path
    Civ5Path := Trim(Civ5DirPage.Values[0]);

    // Path cannot be empty
    if Civ5Path = '' then
    begin
      MsgBox('Please select the Civilization V installation folder.' + #13#10#13#10 +
             'Vox Deorum requires Civilization V to function properly.',
             mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Check if path exists
    if not DirExists(Civ5Path) then
    begin
      MsgBox('The selected folder does not exist:' + #13#10 +
             Civ5Path + #13#10#13#10 +
             'Please select a valid folder.',
             mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Check for CivilizationV.exe
    if not FileExists(Civ5Path + '\CivilizationV.exe') then
    begin
      MsgBox('CivilizationV.exe was not found in the selected folder.' + #13#10#13#10 +
             'This does not appear to be a valid Civilization V installation.' + #13#10 +
             'Please select the correct folder (usually in Steam\steamapps\common\).',
             mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // Never skip any pages - Civ5 installation is required
  Result := False;
end;

// NeedsAddPath function removed - no longer modifying PATH

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  DocsPath: String;
  GameSettingsPath: String;
  EnvFileCreated: Boolean;
begin
  if CurStep = ssPostInstall then
  begin
    EnvFileCreated := False;

    // Set up .env file if it doesn't exist
    if not FileExists(ExpandConstant('{app}\vox-agents\.env')) then
    begin
      FileCopy(ExpandConstant('{app}\vox-agents\.env.default'),
               ExpandConstant('{app}\vox-agents\.env'), False);
      EnvFileCreated := True;
    end;

    // Copy game configuration files
    DocsPath := ExpandConstant('{userdocs}');
    GameSettingsPath := DocsPath + '\My Games\Sid Meier''s Civilization 5';

    if DirExists(GameSettingsPath) then
    begin
      // Copy config.ini if not present
      if not FileExists(GameSettingsPath + '\config.ini') then
      begin
        if FileExists(ExpandConstant('{app}\scripts\configs\config.ini')) then
        begin
          FileCopy(ExpandConstant('{app}\scripts\configs\config.ini'),
                   GameSettingsPath + '\config.ini', False);
        end;
      end;

      // Copy UserSettings.ini if not present
      if not FileExists(GameSettingsPath + '\UserSettings.ini') then
      begin
        if FileExists(ExpandConstant('{app}\scripts\configs\UserSettings.ini')) then
        begin
          FileCopy(ExpandConstant('{app}\scripts\configs\UserSettings.ini'),
                   GameSettingsPath + '\UserSettings.ini', False);
        end;
      end;
    end;

    // Always install mods since we have a valid Civ5 path
    if (Civ5Path <> '') and DirExists(Civ5Path) then
    begin
      // Get Documents folder path for mods
      ModsPath := DocsPath + '\My Games\Sid Meier''s Civilization 5\MODS';

      // Create MODS directory if it doesn't exist
      if not DirExists(ModsPath) then
        CreateDir(ModsPath);

      // Copy mods using xcopy for reliability
      Exec('xcopy', '/E /I /Y "' + ExpandConstant('{app}\civ5-dll\(1) Community Patch') + '" "' + ModsPath + '\(1) Community Patch"',
           '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('xcopy', '/E /I /Y "' + ExpandConstant('{app}\civ5-mod') + '" "' + ModsPath + '\(1b) Vox Deorum"',
           '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('xcopy', '/E /I /Y "' + ExpandConstant('{app}\civ5-dll\(2) Vox Populi') + '" "' + ModsPath + '\(2) Vox Populi"',
           '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('xcopy', '/E /I /Y "' + ExpandConstant('{app}\civ5-dll\(3a) EUI Compatibility Files') + '" "' + ModsPath + '\(3a) EUI Compatibility Files"',
           '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

      // Copy DLL to Community Patch folder
      FileCopy(ExpandConstant('{app}\scripts\release\CvGameCore_Expansion2.dll'),
               ModsPath + '\(1) Community Patch\CvGameCore_Expansion2.dll', True);

      // Copy debug symbols if present
      if FileExists(ExpandConstant('{app}\scripts\release\CvGameCore_Expansion2.pdb')) then
        FileCopy(ExpandConstant('{app}\scripts\release\CvGameCore_Expansion2.pdb'),
                 ModsPath + '\(1) Community Patch\CvGameCore_Expansion2.pdb', True);

      // Copy UI mods to DLC folder
      Exec('xcopy', '/E /I /Y "' + ExpandConstant('{app}\civ5-dll\VPUI') + '" "' + Civ5Path + '\Assets\DLC\VPUI"',
           '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('xcopy', '/E /I /Y "' + ExpandConstant('{app}\civ5-dll\UI_bc1') + '" "' + Civ5Path + '\Assets\DLC\UI_bc1"',
           '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

      // Always copy Lua DLL - it's required for Vox Deorum
      if FileExists(ExpandConstant('{app}\scripts\release\lua51_win32.dll')) then
      begin
        FileCopy(ExpandConstant('{app}\scripts\release\lua51_win32.dll'),
                 Civ5Path + '\lua51_win32.dll', True);
        // Also copy debug symbols if present
        if FileExists(ExpandConstant('{app}\scripts\release\lua51_win32.pdb')) then
          FileCopy(ExpandConstant('{app}\scripts\release\lua51_win32.pdb'),
                   Civ5Path + '\lua51_win32.pdb', True);
      end;
    end;

    // Show message about API configuration if .env was just created
    if EnvFileCreated and not IsTaskSelected('configureapi') then
    begin
      MsgBox('IMPORTANT: You need to configure your LLM API keys!' + #13#10#13#10 +
             'Please edit the file:' + #13#10 +
             ExpandConstant('{app}\vox-agents\.env') + #13#10#13#10 +
             'Add your API keys before running Vox Deorum.',
             mbInformation, MB_OK);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DocsPath: String;
  ModsPath: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    // Optionally remove mods
    if MsgBox('Do you want to remove Vox Deorum mods from Civilization V?', mbConfirmation, MB_YESNO) = IDYES then
    begin
      DocsPath := ExpandConstant('{userdocs}');
      ModsPath := DocsPath + '\My Games\Sid Meier''s Civilization 5\MODS';

      // Remove mod folders
      DelTree(ModsPath + '\(1) Community Patch', True, True, True);
      DelTree(ModsPath + '\(1b) Vox Deorum', True, True, True);
      DelTree(ModsPath + '\(2) Vox Populi', True, True, True);
      DelTree(ModsPath + '\(3a) EUI Compatibility Files', True, True, True);

      // Try to find Civ5 installation to remove UI mods
      Civ5Path := FindCiv5Installation();
      if (Civ5Path <> '') and DirExists(Civ5Path) then
      begin
        DelTree(Civ5Path + '\Assets\DLC\VPUI', True, True, True);
        DelTree(Civ5Path + '\Assets\DLC\UI_bc1', True, True, True);
      end;
    end;
  end;
end;
