﻿#
# This script creates the macOS Code Pulse package
#
param (
	[switch] $forceTracerRebuild
)

Set-PSDebug -Strict
$ErrorActionPreference = 'Stop'
$VerbosePreference = 'Continue'

Push-Location $PSScriptRoot

. ..\Scripts\common.ps1

if ($forceTracerRebuild -or (-not (Test-DotNetTracer $codePulsePath $buildConfiguration))) 
{
    if (-not (Test-MsBuild)) {
        exit 1
    }

    & "$codePulsePath\installers\DotNet-Tracer\build.ps1"
}

Invoke-CodePulsePackaging `
    $codePulseVersion `
    $PSScriptRoot `
    $codePulsePath `
    'macOS' `
    'osx-x64' `
    'packageEmbeddedOsx' `
    "CodePulse-$($codePulseVersion)-SNAPSHOT-osx.zip" `
    'Code Pulse.app\Contents\Resources\app.nw\dotnet-symbol-service' `
    'SymbolService' `
    'Code Pulse.app\Contents\Resources\app.nw\agent.jar'

Invoke-CodePulseZip `
    $PSScriptRoot `
    'macOS' `
    'macOS-x64' `
    $codePulseVersion `
    $zipFilePath `
    'Files\macOS'

Pop-Location
