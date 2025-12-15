$_originalContext = Get-Location
# https://github.com/skycommand/AdminScripts/blob/master/Demos/ANSI%20escape%20sequences.ps1
[Char]$ESC = [Char]27
function Write-Message {
    param (
        [string]$Message,
        [string]$Level
    )
    $color = switch ($Level) {
        default { "[37m" }
        "Success" { "[32m" }
        "Info" { "[34m" }
        "Warning" { "[33m" }
        "Error" { "[31m" }
    }
    Write-Output "$ESC[1m$ESC[37m[$ESC[33mMomoiPlus (Vesktop)$ESC[37m] $ESC[0m$ESC$color$Message$ESC[0m"
}
# check if OS is Windows
if ($env:OS -ne "Windows_NT") {
    Write-Message "This script is intended to run on Windows."
    Exit 1
}
# check if Vesktop is installed
$vesktopDist = "$env:APPDATA\vesktop\sessionData\vencordFiles"
if (!(Test-Path $vesktopDist)) {
    Write-Message "Vesktop is not installed, install it and try again."
    Exit 2
}

$defaultRootPath = $env:TMP
# check if enough space on the disk, get letter from $defaultRootPath
$driveLetter = $defaultRootPath.Substring(0, 1)
$freeSpace = (Get-PSDrive -Name $driveLetter).Free
$requiredSpace = 900MB
if ($freeSpace -lt $requiredSpace) {
    Write-Message "Not enough disk space available. At least 900MB is required." -Level "Error"
    Exit 3
}

$links = @{
    "vencordGit"        = "https://github.com/Vendicated/Vencord.git"
    "momoiPlusGit"      = "https://github.com/ddddjBlue/vencord-momoi-plus.git"
    "minGit"            = "https://github.com/git-for-windows/git/releases/download/v2.51.0.windows.1/MinGit-2.51.0-64-bit.zip"
    "node"              = "https://nodejs.org/dist/v22.19.0/node-v22.19.0-win-x64.zip"
    "pnpm"              = "https://github.com/pnpm/pnpm/releases/download/v10.15.1/pnpm-win-x64.exe"
}
$defaultInstallPath = Join-Path $defaultRootPath "vencord-momoi-plus"
$momoiPlusPath = Join-Path -Path $defaultInstallPath "\src\userplugins\vencord-momoi-plus"

$gitInstalled = Get-Command git -ErrorAction SilentlyContinue
$pnpmInstalled = Get-Command pnpm -ErrorAction SilentlyContinue
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue

# Download pnpm if not installed
if (-not ($pnpmInstalled) -and -not (Test-Path -Path "$defaultRootPath\pnpm")) {
    Write-Message "pnpm is not installed. Installing pnpm..."
    $null = New-Item -ItemType Directory -Path "$defaultRootPath\pnpm"
    Invoke-WebRequest -Uri $links.pnpm -OutFile "$defaultRootPath\pnpm\pnpm.exe"
    $env:Path += ";$defaultRootPath\pnpm"
    # Test
    $pnpmInstalled = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($pnpmInstalled) {
        Write-Message "pnpm installation successful." -Level "Success"
    } else {
        Write-Message "pnpm installation failed." -Level "Error"
        Exit 4
    }
}
else {
    if ($env:Path -notlike "*$defaultRootPath\pnpm*") {
        $env:Path += ";$defaultRootPath\pnpm"
    }
    Write-Message "pnpm is already installed. Skipping."
}

# Download MinGit if no git is installed
if (-not ($gitInstalled) -and -not (Test-Path -Path "$defaultRootPath\MinGit")) {
    Write-Message "Git is not installed. Installing MinGit..."
    Invoke-WebRequest -Uri $links.minGit -OutFile "$defaultRootPath\MinGit.zip"
    $null = New-Item -ItemType Directory -Path "$defaultRootPath\MinGit"
    Expand-Archive -Path "$defaultRootPath\MinGit.zip" -DestinationPath "$defaultRootPath\MinGit\" -Force
    Remove-Item -Path "$defaultRootPath\MinGit.zip" -Force
    $env:Path += ";$defaultRootPath\MinGit\mingw64\bin"
    $gitInstalled = Get-Command git -ErrorAction SilentlyContinue
    if ($gitInstalled) {
        Write-Message "MinGit installation successful." -Level "Success"
    } else {
        Write-Message "MinGit installation failed." -Level "Error"
        Exit 5
    }
} else {
    if ($env:Path -notlike "*$defaultRootPath\MinGit\mingw64\bin*") {
        $env:Path += ";$defaultRootPath\MinGit\mingw64\bin"
    }
    Write-Message "Git is already installed."
}

# Download node if no node is installed
if (-not ($nodeInstalled) -and -not (Test-Path -Path "$defaultRootPath\node")) {
    Write-Message "Node.js is not installed. Installing Node.js..."
    Invoke-WebRequest -Uri $links.node -OutFile "$defaultRootPath\node.zip"
    # create node folder
    $null = New-Item -ItemType Directory -Path "$defaultRootPath\node"
    Expand-Archive -Path "$defaultRootPath\node.zip" -DestinationPath "$defaultRootPath\node\" -Force
    Remove-Item -Path "$defaultRootPath\node.zip" -Force
    $folderName = $links.node.Split("/")[-1].Replace(".zip", "")
    $null = Move-Item -Path "$defaultRootPath\node\$folderName\*" -Destination "$defaultRootPath\node"
    $env:Path += ";$defaultRootPath\node"
    # Test
    $nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeInstalled) {
        Write-Message "Node.js installation successful." -Level "Success"
    } else {
        Write-Message "Node.js installation failed." -Level "Error"
        Exit 6
    }
} else {
    if ($env:Path -notlike "*$defaultRootPath\node*") {
        $env:Path += ";$defaultRootPath\node"
    }
    Write-Message "Node.js is already installed. Skipping."
}

# if defaultInstallPath folder doesn't exist, create one
if (-not (Test-Path -Path $defaultInstallPath)) {
    Write-Message "Cloning Vencord repository to $defaultInstallPath..."
    git clone --depth=1 $links.vencordGit $defaultInstallPath
    # Test
    if (-not (Test-Path -Path $defaultInstallPath)) {
        Write-Message "Failed to clone Vencord repository." -Level "Error"
        Exit 7
    }
    Write-Message "Cloned Vencord repository to $defaultInstallPath" -Level "Success"
} else {
    # If git is installed, pull the latest changes
    Write-Message "Vencord repository already exists. Pulling latest changes..."
    Set-Location -Path $defaultInstallPath
    git pull origin main
    # Test via checking if previous command was successful
    if ($?) {
        Write-Message "Vencord repository updated successfully." -Level "Success"
    } else {
        Write-Message "Failed to update Vencord repository." -Level "Error"
    }
    Set-Location -Path $_originalContext
}

# Check if folder userplugins exists
if (-not (Test-Path -Path "$defaultInstallPath\src\userplugins")) {
    $null = New-Item -ItemType Directory -Path "$defaultInstallPath\src\userplugins"
    Write-Message "Created directory $defaultInstallPath\src\userplugins"
}
# Check if momoiPlus is already installed
if (-not (Test-Path -Path $momoiPlusPath)) {
    Write-Message "Cloning MomoiPlus repository to $momoiPlusPath..."
    git clone --depth=1 $links.momoiPlusGit $momoiPlusPath
    Write-Message "Cloned MomoiPlus repository to $momoiPlusPath" -Level "Success"
}
else {
    Write-Message "MomoiPlus repository already exists. Pulling latest changes..."
    Set-Location -Path $momoiPlusPath
    git pull origin main
    if ($?) {
        Write-Message "MomoiPlus repository updated successfully." -Level "Success"
    } else {
        Write-Message "Failed to update MomoiPlus repository." -Level "Warning"
    }
    Set-Location -Path $_originalContext
}
# Install dependencies using pnpm
Set-Location -Path "$defaultInstallPath"
Write-Message "Installing dependencies using pnpm..."
pnpm install
if ($?) {
    Write-Message "Dependencies installed successfully." -Level "Success"
} else {
    Write-Message "Failed to install dependencies." -Level "Error"
    Exit 8
}
# Build Vencord
Write-Message "Building Vencord..."
pnpm run build
if ($?) {
    Write-Message "Vencord built successfully." -Level "Success"
} else {
    Write-Message "Failed to build Vencord." -Level "Error"
    Exit 9
}

# Copy dist to $vesktopDist
Write-Message "Patching Vesktop..."
$sourceDist = Join-Path -Path $defaultInstallPath -ChildPath "dist"
if (Test-Path -Path $sourceDist) {
    try {
        Copy-Item -Path "$sourceDist\*" -Destination $vesktopDist -Recurse -Force
    }
    catch {
        Write-Message "Error patching Vesktop: $_" -Level "Error"
        Exit 10
    }
    Write-Message "Successfully patched Vesktop." -Level "Success"
} else {
    Write-Message "Vencord build not found. Cannot copy files." -Level "Error"
    Exit 11
}
Write-Message "Restart Vesktop (via tray) to apply changes." -Level "Warning"
Write-Message "To enable MomoiPlus plugin, go to Settings > Plugins > MomoiPlus, restart Discord and enjoy." -Level "Info"
Write-Output "$ESC[35mLife... is Kuyashi.$ESC[0m"
# Return to original location
Set-Location -Path $_originalContext
