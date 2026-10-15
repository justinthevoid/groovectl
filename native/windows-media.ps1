# Uses the documented Windows.Media.Control API. Targets Apple's session explicitly.
# Windows PowerShell 5.1 is intentional: its WinRT projection ships with Windows.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
    $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    function Await-WinRT($operation, [Type]$resultType) {
        $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
            $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
        } | Select-Object -First 1
        $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))
        if (-not $task.Wait(8000)) { throw 'Windows media session timed out.' }
        return $task.Result
    }
    $managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
    $manager = Await-WinRT ($managerType::RequestAsync()) $managerType
    $sessions = @($manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -match '^AppleInc\.AppleMusic(?:Win)?_[A-Za-z0-9_]+!App$' })
    if ($sessions.Count -eq 0) {
        if ($request.action -ne 'status') { throw 'No Apple Music media session. Open Apple Music and start a song once.' }
        @{running=$false;state='stopped';player='windows';reason='No Apple Music media session. Open Apple Music and start a song once.'} | ConvertTo-Json -Compress
        exit 0
    }
    if ($sessions.Count -ne 1) { throw 'Multiple Apple Music sessions found; refusing to control an ambiguous player.' }
    $session = $sessions[0]
    $info = $session.GetPlaybackInfo()
    $controls = $info.Controls
    if ($request.playlist_id -or $request.track_id) { throw 'Windows media sessions cannot play a catalog ID or browse the library. Use Cider for targeted playback.' }
    $operation = $null
    switch ($request.action) {
        'status' {}
        'play' { if (-not $controls.IsPlayEnabled) { throw 'Play is not supported by this session.' }; $operation = $session.TryPlayAsync() }
        'pause' { if (-not $controls.IsPauseEnabled) { throw 'Pause is not supported by this session.' }; $operation = $session.TryPauseAsync() }
        'stop' { if (-not $controls.IsStopEnabled) { throw 'Stop is not supported by this session.' }; $operation = $session.TryStopAsync() }
        'next' { if (-not $controls.IsNextEnabled) { throw 'Next is not supported by this session.' }; $operation = $session.TrySkipNextAsync() }
        'previous' { if (-not $controls.IsPreviousEnabled) { throw 'Previous is not supported by this session.' }; $operation = $session.TrySkipPreviousAsync() }
        'seek' {
            if (-not $controls.IsPlaybackPositionEnabled -or $null -eq $request.value -or $request.value -lt 0 -or $request.value -gt 86400) { throw 'Seek is unsupported or out of range.' }
            $operation = $session.TryChangePlaybackPositionAsync([long]($request.value * 10000000))
        }
        default { throw 'This action is not supported by Windows media sessions. Select Cider for volume, shuffle and repeat.' }
    }
    if ($null -ne $operation -and -not (Await-WinRT $operation ([bool]))) { throw 'Apple Music rejected the playback command.' }
    $propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
    $media = Await-WinRT ($session.TryGetMediaPropertiesAsync()) $propertiesType
    $timeline = $session.GetTimelineProperties()
    @{
        running=$true;state=$session.GetPlaybackInfo().PlaybackStatus.ToString().ToLowerInvariant();player='windows';session_id=$session.SourceAppUserModelId;
        position=$timeline.Position.TotalSeconds;
        media=@{title=$media.Title;artist=$media.Artist;album=$media.AlbumTitle};
        track=$null;
        capabilities=@{play=$controls.IsPlayEnabled;pause=$controls.IsPauseEnabled;stop=$controls.IsStopEnabled;next=$controls.IsNextEnabled;previous=$controls.IsPreviousEnabled;seek=$controls.IsPlaybackPositionEnabled}
    } | ConvertTo-Json -Depth 6 -Compress
} catch {
    $cause=$_.Exception
    while ($null -ne $cause.InnerException) { $cause=$cause.InnerException }
    @{error=('Windows Apple Music session unavailable: '+$cause.Message+' Run Groovectl in the signed-in Windows desktop session; SSH/service sessions may not have media-session access.')} | ConvertTo-Json -Compress
    exit 0
}
