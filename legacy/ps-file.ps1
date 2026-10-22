# Bestandsaufnahme IT-Hardware
# Windows-Programm mit Baumansicht (wie der Registrierungs-Editor).
# Starten: Doppelklick auf «Bestandsaufnahme starten.bat».
# Kundendaten werden als .json-Datei im Kundenordner gespeichert.
param([string]$Datei)

# Startfehler sichtbar machen (Meldung + Fehler.txt neben dem Skript)
$ErrorActionPreference = 'Stop'
trap {
  $msg = "Die Bestandsaufnahme konnte nicht starten.`r`n`r`n$($_.Exception.Message)`r`n`r`nZeile $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())`r`nPowerShell $($PSVersionTable.PSVersion) / Sprachmodus: $($ExecutionContext.SessionState.LanguageMode)"
  Write-Host $msg -ForegroundColor Red
  try { $msg | Out-File -FilePath (Join-Path $PSScriptRoot 'Fehler.txt') -Encoding UTF8 } catch { }
  try { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show($msg, 'Bestandsaufnahme', 'OK', 'Error') | Out-Null } catch { }
  exit 1
}
if ($ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') {
  throw "PowerShell läuft hier im eingeschränkten Modus ($($ExecutionContext.SessionState.LanguageMode)). Das wird meist von der IT (AppLocker/Schulrichtlinie) vorgegeben und blockiert Programme mit Fenstern."
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# =====================================================================
#  Schema
# =====================================================================
function F($k, $l, $t = 'text', $o = $null) { return ,@($k, $l, $t, $o) }

$TYPES  = @('NUC', 'Notebook', 'PC', 'Thin Client', 'Server', 'Drucker', 'Andere')
$NETCAT = @('Switch', 'Router', 'Firewall', 'Access Point', 'Andere')
$JN     = @('Ja', 'Nein')

$SCH = [ordered]@{
  geraete = @{ one = 'Gerät'; many = 'Geräte'; icon = 'pc'; fields = @(
      (F 'name' 'Geräte-Name'), (F 'typ' 'Typ' 'select' $TYPES), (F 'modell' 'Hersteller / Modell'), (F 'sn' 'Seriennummer'),
      (F 'ip' 'IP-Adresse'), (F 'mac' 'MAC-Adresse'), (F 'standort' 'Standort' 'ref' 'standorte'), (F 'raum' 'Raum'),
      (F 'lieferdatum' 'Lieferdatum (TT.MM.JJJJ)'), (F 'garantie' 'Garantie bis (TT.MM.JJJJ)'),
      (F 'zustand' 'Zustand' 'select' @('gut', 'mittel', 'ersetzen')), (F 'switch' 'Switch' 'ref' 'netzwerk'),
      (F 'port' 'Switch-Port'), (F 'bemerkung' 'Bemerkung')) }
  benutzer = @{ one = 'Benutzer'; many = 'Benutzer'; icon = 'user'; fields = @(
      (F 'name' 'Name (Nachname Vorname)'), (F 'login' 'Benutzername'), (F 'abteilung' 'Abteilung'), (F 'funktion' 'Funktion'),
      (F 'email' 'E-Mail'), (F 'mfa' 'MFA' 'select' $JN), (F 'admin' 'Admin-Rechte' 'select' $JN), (F 'bemerkung' 'Bemerkung')) }
  netzwerk = @{ one = 'Netzwerkkomponente'; many = 'Netzwerk'; icon = 'net'; fields = @(
      (F 'name' 'Name'), (F 'kategorie' 'Kategorie' 'select' $NETCAT), (F 'modell' 'Hersteller / Modell'), (F 'sn' 'Seriennummer'),
      (F 'ip' 'IP-Adresse'), (F 'mac' 'MAC-Adresse'), (F 'firmware' 'Firmware'), (F 'standort' 'Standort' 'ref' 'standorte'),
      (F 'rack' 'Raum / Rack'), (F 'ports' 'Ports gesamt'), (F 'uplink' 'Uplink zu'), (F 'support' 'Garantie / Support bis'),
      (F 'bemerkung' 'Bemerkung')) }
  applikationen = @{ one = 'Applikation'; many = 'Applikationen'; icon = 'app'; fields = @(
      (F 'name' 'Applikation'), (F 'version' 'Version'), (F 'hersteller' 'Hersteller'), (F 'lizenzart' 'Lizenzart'),
      (F 'kritisch' 'Business-kritisch' 'select' $JN)) }
  lizenzen = @{ one = 'Lizenz'; many = 'Lizenzen'; icon = 'lic'; fields = @(
      (F 'produkt' 'Lizenztyp / Produkt'), (F 'art' 'Lizenzart'), (F 'gekauft' 'Gekauft (Anzahl)'),
      (F 'laufzeit' 'Laufzeit / Erneuerung'), (F 'bemerkung' 'Bemerkung')) }
  standorte = @{ one = 'Standort'; many = 'Standorte'; icon = 'site'; fields = @(
      (F 'name' 'Name'), (F 'adresse' 'Adresse'), (F 'raeume' 'Räume'),
      (F 'kontakt' 'Ansprechperson / Telefon / E-Mail'), (F 'serverraum' 'Serverraum / Rack')) }
  postfaecher = @{ one = 'Postfach'; many = 'Postfächer'; icon = 'mail'; fields = @(
      (F 'adresse' 'E-Mail-Adresse'), (F 'typ' 'Typ' 'select' @('Shared Mailbox', 'Ressource', 'Verteilerliste')),
      (F 'besitzer' 'Besitzer'), (F 'hosting' 'Hosting' 'select' @('M365', 'Exchange', 'andere'))) }
  monitore = @{ one = 'Monitor'; many = 'Monitore'; icon = 'mon'; hidden = $true; fields = @(
      (F 'inv' 'Inventar-Nr.'), (F 'modell' 'Hersteller / Modell'), (F 'sn' 'Seriennummer'), (F 'anschluss' 'Anschluss'),
      (F 'geraet' 'Angeschlossen an' 'ref' 'geraete')) }
}
$KUNDE = @((F 'name' 'Kunde'), (F 'nr' 'Kunden-Nr.'), (F 'kontakt' 'Hauptansprechperson'), (F 'datum' 'Datum der Aufnahme'),
  (F 'durch' 'Aufgenommen durch'), (F 'version' 'Version'))
$ORDER = @('geraete', 'benutzer', 'netzwerk', 'applikationen', 'lizenzen', 'standorte', 'postfaecher')

# =====================================================================
#  Daten
# =====================================================================
function New-Data {
  $d = @{ kunde = @{}; portInfo = @{}; format = 'bestandsaufnahme-1' }
  foreach ($k in $SCH.Keys) { $d[$k] = New-Object System.Collections.ArrayList }
  return $d
}
$script:D = New-Data
$script:FilePath = ''
$script:Dirty = $false
$script:Suppress = $false

function New-Id { [guid]::NewGuid().ToString('N').Substring(0, 8) }
function Key-Of($col, $id) { return ($col + '/' + $col + ':' + $id) }
function To-Int($v) { $r = 0; if ([int]::TryParse([string]$v, [ref]$r)) { return $r } else { return 0 } }
function Get-ById($col, $id) {
  if (-not $id) { return $null }
  foreach ($e in $script:D[$col]) { if ($e.id -eq $id) { return $e } }
  return $null
}
function Get-Title($col, $e) {
  if ($null -eq $e) { return '' }
  $t = switch ($col) {
    'standorte'   { [string]$e.name }
    'lizenzen'    { [string]$e.produkt }
    'postfaecher' { [string]$e.adresse }
    'monitore'    { if ($e.inv) { [string]$e.inv } else { [string]$e.modell } }
    default       { [string]$e.name }
  }
  if ([string]::IsNullOrWhiteSpace($t)) { return '(ohne Namen)' }
  return $t
}
function Find-ByTitle($col, $title) {
  if (-not $title) { return $null }
  foreach ($e in $script:D[$col]) { if ((Get-Title $col $e) -eq $title) { return $e } }
  return $null
}
function List-Of($v) { return @(@($v) | Where-Object { $_ }) }
function Devices-OfUser($uid)   { return @($script:D.geraete | Where-Object { (List-Of $_.benutzer) -contains $uid }) }
function Devices-WithApp($aid)  { return @($script:D.geraete | Where-Object { (List-Of $_.apps) -contains $aid }) }
function Users-WithLic($lid)    { return @($script:D.benutzer | Where-Object { (List-Of $_.lizenzen) -contains $lid }) }
function Devices-WithLic($lid)  { return @($script:D.geraete | Where-Object { (List-Of $_.lizenzen) -contains $lid }) }
# Eine Lizenz kann Benutzern, Geräten oder beiden zugewiesen werden; gezählt wird beides.
function Lic-ForUsers($l)   { return $true }
function Lic-ForDevices($l) { return $true }
function Lic-Used($l) {
  $n = 0
  if (Lic-ForUsers $l) { $n += @(Users-WithLic $l.id).Count }
  if (Lic-ForDevices $l) { $n += @(Devices-WithLic $l.id).Count }
  return $n
}
function Lic-AssignedNames($l) {
  $a = @()
  if (Lic-ForUsers $l) { $a += @(Users-WithLic $l.id | ForEach-Object { $_.name }) }
  if (Lic-ForDevices $l) { $a += @(Devices-WithLic $l.id | ForEach-Object { $_.name }) }
  return ($a -join ', ')
}
function Is-Expired($d) {
  $dt = [datetime]::MinValue
  if ([datetime]::TryParseExact(([string]$d).Trim(), [string[]]@('d.M.yyyy', 'dd.MM.yyyy', 'yyyy-MM-dd'), [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$dt)) { return $dt -lt (Get-Date).Date }
  return $false
}
function Get-PortInfo($nid, $p) {
  $all = $script:D.portInfo[$nid]
  if ($all -and $all["$p"]) { return $all["$p"] }
  return @{}
}
function Get-Ports($n) {
  $max = To-Int $n.ports
  foreach ($g in $script:D.geraete) { if ($g.switch -eq $n.id -and (To-Int $g.port) -gt $max) { $max = To-Int $g.port } }
  $rows = @()
  for ($p = 1; $p -le $max; $p++) {
    $dev = $null
    foreach ($g in $script:D.geraete) { if ($g.switch -eq $n.id -and (To-Int $g.port) -eq $p) { $dev = $g; break } }
    $i = Get-PortInfo $n.id $p
    $st = if ($dev) { 'gepatcht' } elseif ($i.status -eq 'defekt') { 'defekt' } elseif ($i.bemerkung) { 'belegt' } else { 'frei' }
    $rows += [pscustomobject]@{ p = $p; dev = $dev; status = $st; info = $i }
  }
  return ,$rows
}
function Get-PortStats($n) {
  $r = Get-Ports $n
  $total = To-Int $n.ports; if ($total -lt $r.Count) { $total = $r.Count }
  $gep = @($r | Where-Object { $_.status -eq 'gepatcht' -or $_.status -eq 'belegt' }).Count
  $def = @($r | Where-Object { $_.status -eq 'defekt' }).Count
  return @{ total = $total; gepatcht = $gep; defekt = $def; frei = [math]::Max(0, $total - $gep - $def) }
}
function Mark-Dirty { $script:Dirty = $true; Update-Title }

# ---- Laden / Speichern ----
function ConvertTo-HT($o) {
  if ($o -is [System.Management.Automation.PSCustomObject]) {
    $h = @{}; foreach ($p in $o.PSObject.Properties) { $h[$p.Name] = ConvertTo-HT $p.Value }; return $h
  } elseif ($o -is [System.Collections.IEnumerable] -and $o -isnot [string]) {
    $a = New-Object System.Collections.ArrayList; foreach ($x in $o) { [void]$a.Add((ConvertTo-HT $x)) }; return ,$a
  } else { return $o }
}
function Load-File($path) {
  try {
    $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $h = ConvertTo-HT ($raw | ConvertFrom-Json)
    if (-not ($h -is [hashtable]) -or -not $h.ContainsKey('geraete')) { throw 'Keine Bestandsaufnahme-Datei.' }
    $d = New-Data
    foreach ($k in @($h.Keys)) {
      if ($SCH.Contains($k)) { foreach ($e in @($h[$k])) { if ($e -is [hashtable]) { [void]$d[$k].Add($e) } } }
      elseif ($k -eq 'kunde' -and $h[$k] -is [hashtable]) { $d.kunde = $h[$k] }
      elseif ($k -eq 'portInfo' -and $h[$k] -is [hashtable]) { $d.portInfo = $h[$k] }
    }
    # ältere Dateien angleichen: 'Desktop-PC' -> 'PC', Standort-ID -> Name
    foreach ($g in $d.geraete) { if ($g.typ -eq 'Desktop-PC') { $g.typ = 'PC' } }
    foreach ($st in $d.standorte) { if (-not $st.name -and $st.kurz) { $st.name = $st.kurz }; if ($st.ContainsKey('kurz')) { $st.Remove('kurz') } }
    $script:D = $d; $script:FilePath = $path; $script:Dirty = $false
    # alte .json-Dateien beim nächsten Speichern als .bestand daneben ablegen
    if ([IO.Path]::GetExtension($path) -ieq '.json') { $script:FilePath = [IO.Path]::ChangeExtension($path, '.bestand'); $script:Dirty = $true }
    Rebuild-Tree; $tree.SelectedNode = $tree.Nodes[0]; $tree.Nodes[0].Expand(); Show-Node $tree.Nodes[0]; Update-Title
  } catch {
    [System.Windows.Forms.MessageBox]::Show("Die Datei konnte nicht geöffnet werden.`n`n$($_.Exception.Message)", 'Öffnen', 'OK', 'Warning') | Out-Null
  }
}
function Commit-Edits { foreach ($c in @($body.Controls)) { if ($c -is [System.Windows.Forms.DataGridView]) { [void]$c.EndEdit() } } }
function Save-File([bool]$as) {
  Commit-Edits
  if ($as -or -not $script:FilePath) {
    $dlg = New-Object System.Windows.Forms.SaveFileDialog
    $dlg.Filter = 'Bestandsaufnahme (*.bestand)|*.bestand|Alle Dateien (*.*)|*.*'
    $name = ([string]$script:D.kunde.name) -replace '[\\/:*?"<>|]', '_'
    if (-not $name) { $name = 'Kunde' }
    $dlg.FileName = if ($script:FilePath) { [IO.Path]::GetFileName($script:FilePath) } else { "Bestandsaufnahme $name.bestand" }
    if ($dlg.ShowDialog($form) -ne 'OK') { return $false }
    $script:FilePath = $dlg.FileName
  }
  try {
    $json = $script:D | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($script:FilePath, $json, (New-Object System.Text.UTF8Encoding($true)))
    $script:Dirty = $false; Update-Title
    $status.Text = 'Gespeichert: ' + $script:FilePath
    return $true
  } catch {
    [System.Windows.Forms.MessageBox]::Show("Speichern hat nicht geklappt.`n`n$($_.Exception.Message)", 'Speichern', 'OK', 'Error') | Out-Null
    return $false
  }
}
function Confirm-Discard {
  Commit-Edits
  if (-not $script:Dirty) { return $true }
  $r = [System.Windows.Forms.MessageBox]::Show('Änderungen speichern?', 'Bestandsaufnahme', 'YesNoCancel', 'Question')
  if ($r -eq 'Yes') { return (Save-File $false) }
  return ($r -eq 'No')
}

# =====================================================================
#  Icons (16x16, selbst gezeichnet)
# =====================================================================
$images = New-Object System.Windows.Forms.ImageList
$images.ColorDepth = 'Depth32Bit'; $images.ImageSize = New-Object System.Drawing.Size(16, 16)
function Add-Icon($name, [scriptblock]$draw) {
  $bmp = New-Object System.Drawing.Bitmap 16, 16
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'
  & $draw $g; $g.Dispose(); $images.Images.Add($name, $bmp)
}
$cFolder = [System.Drawing.Color]::FromArgb(232, 180, 64); $cFolderDk = [System.Drawing.Color]::FromArgb(190, 140, 30)
$cBlue = [System.Drawing.Color]::FromArgb(31, 56, 100); $cGrey = [System.Drawing.Color]::FromArgb(110, 115, 125)
Add-Icon 'folder' { param($g)
  $pts = [System.Drawing.Point[]]@((New-Object System.Drawing.Point 1, 3), (New-Object System.Drawing.Point 6, 3), (New-Object System.Drawing.Point 8, 5),
    (New-Object System.Drawing.Point 15, 5), (New-Object System.Drawing.Point 15, 14), (New-Object System.Drawing.Point 1, 14))
  $g.FillPolygon((New-Object System.Drawing.SolidBrush $cFolder), $pts); $g.DrawPolygon((New-Object System.Drawing.Pen $cFolderDk), $pts)
  $g.DrawLine((New-Object System.Drawing.Pen $cFolderDk), 1, 6, 15, 6) }
Add-Icon 'pc' { param($g) $p = New-Object System.Drawing.Pen $cBlue, 1.4
  $g.DrawRectangle($p, 1, 2, 13, 8); $g.DrawLine($p, 8, 11, 8, 13); $g.DrawLine($p, 4, 14, 12, 14) }
Add-Icon 'user' { param($g) $p = New-Object System.Drawing.Pen $cBlue, 1.4
  $g.DrawEllipse($p, 5, 1, 6, 6); $g.DrawArc($p, 2, 9, 12, 10, 180, 180) }
Add-Icon 'net' { param($g) $p = New-Object System.Drawing.Pen $cBlue, 1.4
  $g.DrawRectangle($p, 1, 4, 14, 7); $b = New-Object System.Drawing.SolidBrush $cBlue
  foreach ($x in 3, 6, 9, 12) { $g.FillRectangle($b, $x, 7, 2, 2) } }
Add-Icon 'port' { param($g) $p = New-Object System.Drawing.Pen $cGrey, 1.2
  $g.DrawRectangle($p, 2, 3, 12, 10); $g.DrawRectangle($p, 5, 8, 6, 5); $g.DrawLine($p, 7, 6, 9, 6) }
Add-Icon 'value' { param($g)
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.DrawString('ab', (New-Object System.Drawing.Font 'Consolas', 7, ([System.Drawing.FontStyle]::Bold)), (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 50, 40))), 0, 2) }
foreach ($n in 'app', 'lic', 'site', 'mail', 'mon') { $images.Images.Add($n, $images.Images['value']) }
$images.Images.RemoveByKey('mon'); Add-Icon 'mon' { param($g) $p = New-Object System.Drawing.Pen $cGrey, 1.4
  $g.DrawRectangle($p, 1, 2, 14, 9); $g.DrawLine($p, 6, 14, 10, 14) }

# =====================================================================
#  Fenster
# =====================================================================
$fontUi = New-Object System.Drawing.Font 'Segoe UI', 9
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Bestandsaufnahme'; $form.Size = New-Object System.Drawing.Size(1150, 760); $form.StartPosition = 'CenterScreen'
$form.Font = $fontUi; $form.KeyPreview = $true
try { $form.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon("$env:windir\regedit.exe") } catch { }

# Menü
$menu = New-Object System.Windows.Forms.MenuStrip
function Add-Menu($parent, $text, $keys, [scriptblock]$action) {
  $i = New-Object System.Windows.Forms.ToolStripMenuItem $text
  if ($keys) { $i.ShortcutKeys = $keys }
  if ($action) { $i.add_Click($action) }
  [void]$parent.DropDownItems.Add($i); return $i
}
$mDatei = New-Object System.Windows.Forms.ToolStripMenuItem '&Datei'
$mBearb = New-Object System.Windows.Forms.ToolStripMenuItem '&Bearbeiten'
$mAnsicht = New-Object System.Windows.Forms.ToolStripMenuItem '&Ansicht'
[void]$menu.Items.AddRange(@($mDatei, $mBearb, $mAnsicht))
Add-Menu $mDatei '&Neu' ([System.Windows.Forms.Keys]'Control, N') { if (Confirm-Discard) { New-Document } } | Out-Null
Add-Menu $mDatei '&Öffnen…' ([System.Windows.Forms.Keys]'Control, O') { Open-Dialog } | Out-Null
Add-Menu $mDatei '&Speichern' ([System.Windows.Forms.Keys]'Control, S') { Save-File $false | Out-Null } | Out-Null
Add-Menu $mDatei 'Speichern &unter…' ([System.Windows.Forms.Keys]'Control, Shift, S') { Save-File $true | Out-Null } | Out-Null
[void]$mDatei.DropDownItems.Add((New-Object System.Windows.Forms.ToolStripSeparator))
Add-Menu $mDatei 'Nach &Excel exportieren (.xlsx)…' $null { Export-Excel } | Out-Null
[void]$mDatei.DropDownItems.Add((New-Object System.Windows.Forms.ToolStripSeparator))
Add-Menu $mDatei '&Beenden' $null { $form.Close() } | Out-Null
$miNeu = Add-Menu $mBearb '&Neuer Eintrag' ([System.Windows.Forms.Keys]'Control, E') { New-InCurrent }
$miDel = Add-Menu $mBearb '&Löschen' $null { Delete-Current }
Add-Menu $mAnsicht 'Alles &aufklappen' $null { $tree.ExpandAll(); $tree.Nodes[0].EnsureVisible() } | Out-Null
Add-Menu $mAnsicht 'Alles &zuklappen' $null { $tree.CollapseAll(); $tree.Nodes[0].Expand() } | Out-Null

# Adressleiste
$addr = New-Object System.Windows.Forms.TextBox
$addr.Dock = 'Top'; $addr.ReadOnly = $true; $addr.BorderStyle = 'FixedSingle'; $addr.BackColor = [System.Drawing.SystemColors]::Window

# Statusleiste
$statusStrip = New-Object System.Windows.Forms.StatusStrip
$status = New-Object System.Windows.Forms.ToolStripStatusLabel; $status.Spring = $true; $status.TextAlign = 'MiddleLeft'
[void]$statusStrip.Items.Add($status)

# Split
$split = New-Object System.Windows.Forms.SplitContainer
$split.Dock = 'Fill'; $split.SplitterWidth = 5

$tree = New-Object System.Windows.Forms.TreeView
$tree.Dock = 'Fill'; $tree.ImageList = $images; $tree.HideSelection = $false; $tree.PathSeparator = '\'
$tree.ShowLines = $true; $tree.ItemHeight = 20; $tree.BorderStyle = 'None'
$split.Panel1.Controls.Add($tree)

# rechte Seite
$header = New-Object System.Windows.Forms.Panel; $header.Dock = 'Top'; $header.Height = 64; $header.Padding = New-Object System.Windows.Forms.Padding(12, 8, 12, 4)
$lblKind = New-Object System.Windows.Forms.Label; $lblKind.AutoSize = $true; $lblKind.ForeColor = $cGrey; $lblKind.Location = New-Object System.Drawing.Point(12, 8)
$lblTitle = New-Object System.Windows.Forms.Label; $lblTitle.AutoSize = $true; $lblTitle.Font = New-Object System.Drawing.Font 'Segoe UI Semibold', 14
$lblTitle.Location = New-Object System.Drawing.Point(10, 26)
$btnBar = New-Object System.Windows.Forms.FlowLayoutPanel; $btnBar.FlowDirection = 'RightToLeft'; $btnBar.Dock = 'Right'; $btnBar.Width = 420; $btnBar.WrapContents = $false
$btnBar.Padding = New-Object System.Windows.Forms.Padding(0, 14, 0, 0)
$header.Controls.AddRange(@($btnBar, $lblKind, $lblTitle))
$body = New-Object System.Windows.Forms.Panel; $body.Dock = 'Fill'; $body.Padding = New-Object System.Windows.Forms.Padding(12, 4, 12, 12)
$split.Panel2.Controls.Add($body); $split.Panel2.Controls.Add($header)

$form.Controls.Add($split); $form.Controls.Add($addr); $form.Controls.Add($statusStrip); $form.Controls.Add($menu)
$form.MainMenuStrip = $menu

# Kontextmenü im Baum
$ctx = New-Object System.Windows.Forms.ContextMenuStrip
$tree.ContextMenuStrip = $ctx

# =====================================================================
#  Baum
# =====================================================================
function Add-Node($nodes, $key, $text, $img, $tag) {
  $n = New-Object System.Windows.Forms.TreeNode $text
  $n.Name = $key; $n.ImageKey = $img; $n.SelectedImageKey = $img; $n.Tag = $tag
  [void]$nodes.Add($n); return $n
}
function Entity-Text($col, $e) {
  $t = Get-Title $col $e
  if ($col -eq 'geraete') { if ($e.zustand -eq 'ersetzen') { $t += '   [ersetzen]' } elseif (Is-Expired $e.garantie) { $t += '   [Garantie abgelaufen]' } }
  if ($col -eq 'lizenzen') { $t += "   [$(Lic-Used $e) / $(To-Int $e.gekauft)]" }
  if ($col -eq 'netzwerk' -and (To-Int $e.ports) -gt 0) { $pst = Get-PortStats $e; $t += "   [$($pst.gepatcht)/$($pst.total) Ports]" }
  return $t
}
function Add-LinkLeaves($nodes, $base, $col, $list) {
  foreach ($x in $list) { Add-Node $nodes ($base + '/' + $x.id) (Get-Title $col $x) $SCH[$col].icon @{ kind = 'entity'; col = $col; id = $x.id } | Out-Null }
}
function Build-Entity($nodes, $col, $e, $key) {
  $node = Add-Node $nodes $key (Entity-Text $col $e) $SCH[$col].icon @{ kind = 'entity'; col = $col; id = $e.id }
  switch ($col) {
    'geraete' {
      $us = @(List-Of $e.benutzer | ForEach-Object { Get-ById 'benutzer' $_ } | Where-Object { $_ })
      $as = @(List-Of $e.apps | ForEach-Object { Get-ById 'applikationen' $_ } | Where-Object { $_ })
      $ms = @($script:D.monitore | Where-Object { $_.geraet -eq $e.id })
      $n = Add-Node $node.Nodes "$key/benutzer" "Benutzer ($($us.Count))" 'folder' @{ kind = 'assign'; col = 'geraete'; id = $e.id; field = 'benutzer'; target = 'benutzer' }
      Add-LinkLeaves $n.Nodes "$key/benutzer" 'benutzer' $us
      $n = Add-Node $node.Nodes "$key/apps" "Applikationen ($($as.Count))" 'folder' @{ kind = 'assign'; col = 'geraete'; id = $e.id; field = 'apps'; target = 'applikationen' }
      Add-LinkLeaves $n.Nodes "$key/apps" 'applikationen' $as
      $dl = @(List-Of $e.lizenzen | ForEach-Object { Get-ById 'lizenzen' $_ } | Where-Object { $_ })
      $n = Add-Node $node.Nodes "$key/lizenzen" "Lizenzen ($($dl.Count))" 'folder' @{ kind = 'assign'; col = 'geraete'; id = $e.id; field = 'lizenzen'; target = 'lizenzen' }
      Add-LinkLeaves $n.Nodes "$key/lizenzen" 'lizenzen' $dl
      $n = Add-Node $node.Nodes "$key/monitore" "Monitore ($($ms.Count))" 'folder' @{ kind = 'monitors'; id = $e.id }
      Add-LinkLeaves $n.Nodes "$key/monitore" 'monitore' $ms
      $sw = Get-ById 'netzwerk' $e.switch
      $txt = if ($sw) { "Netzwerkanschluss: $($sw.name) / Port $($e.port)" } else { 'Netzwerkanschluss: nicht erfasst' }
      Add-Node $node.Nodes "$key/netz" $txt 'port' @{ kind = 'entity'; col = 'geraete'; id = $e.id; focus = 'netz' } | Out-Null
    }
    'benutzer' {
      $gs = @(Devices-OfUser $e.id)
      $ls = @(List-Of $e.lizenzen | ForEach-Object { Get-ById 'lizenzen' $_ } | Where-Object { $_ })
      $n = Add-Node $node.Nodes "$key/geraete" "Geräte ($($gs.Count))" 'folder' @{ kind = 'list'; col = 'geraete'; ids = @($gs | ForEach-Object { $_.id }); title = "Geräte von $(Get-Title 'benutzer' $e)" }
      Add-LinkLeaves $n.Nodes "$key/geraete" 'geraete' $gs
      $n = Add-Node $node.Nodes "$key/lizenzen" "Lizenzen ($($ls.Count))" 'folder' @{ kind = 'assign'; col = 'benutzer'; id = $e.id; field = 'lizenzen'; target = 'lizenzen' }
      Add-LinkLeaves $n.Nodes "$key/lizenzen" 'lizenzen' $ls
    }
    'netzwerk' {
      $ps = Get-Ports $e
      if ($ps.Count -gt 0) {
        $n = Add-Node $node.Nodes "$key/ports" "Ports ($($ps.Count))" 'folder' @{ kind = 'ports'; id = $e.id }
        foreach ($r in $ps) {
          $t = "Port $($r.p)"
          if ($r.dev) { $t += ' · ' + $r.dev.name } elseif ($r.info.bemerkung) { $t += ' · ' + $r.info.bemerkung }
          if ($r.status -eq 'defekt') { $t += '   [defekt]' } elseif ($r.status -eq 'frei') { $t += '   [frei]' }
          Add-Node $n.Nodes "$key/ports/$($r.p)" $t 'port' @{ kind = 'port'; id = $e.id; p = $r.p } | Out-Null
        }
      }
      $gs = @($script:D.geraete | Where-Object { $_.switch -eq $e.id })
      $n = Add-Node $node.Nodes "$key/geraete" "Angeschlossene Geräte ($($gs.Count))" 'folder' @{ kind = 'list'; col = 'geraete'; ids = @($gs | ForEach-Object { $_.id }); title = "An $($e.name) angeschlossen" }
      Add-LinkLeaves $n.Nodes "$key/geraete" 'geraete' $gs
    }
    'applikationen' {
      $gs = @(Devices-WithApp $e.id)
      $n = Add-Node $node.Nodes "$key/geraete" "Installiert auf ($($gs.Count))" 'folder' @{ kind = 'reverse'; col = 'applikationen'; id = $e.id; field = 'apps'; target = 'geraete' }
      Add-LinkLeaves $n.Nodes "$key/geraete" 'geraete' $gs
    }
    'lizenzen' {
      if (Lic-ForUsers $e) {
        $us = @(Users-WithLic $e.id)
        $n = Add-Node $node.Nodes "$key/benutzer" "Benutzer ($($us.Count))" 'folder' @{ kind = 'reverse'; col = 'lizenzen'; id = $e.id; field = 'lizenzen'; target = 'benutzer' }
        Add-LinkLeaves $n.Nodes "$key/benutzer" 'benutzer' $us
      }
      if (Lic-ForDevices $e) {
        $gs = @(Devices-WithLic $e.id)
        $n = Add-Node $node.Nodes "$key/geraete" "Geräte ($($gs.Count))" 'folder' @{ kind = 'reverse'; col = 'lizenzen'; id = $e.id; field = 'lizenzen'; target = 'geraete' }
        Add-LinkLeaves $n.Nodes "$key/geraete" 'geraete' $gs
      }
    }
    'standorte' {
      $gs = @($script:D.geraete | Where-Object { $_.standort -eq $e.id })
      $n = Add-Node $node.Nodes "$key/geraete" "Geräte ($($gs.Count))" 'folder' @{ kind = 'list'; col = 'geraete'; ids = @($gs | ForEach-Object { $_.id }); title = 'Geräte am Standort' }
      Add-LinkLeaves $n.Nodes "$key/geraete" 'geraete' $gs
      $ns = @($script:D.netzwerk | Where-Object { $_.standort -eq $e.id })
      $n = Add-Node $node.Nodes "$key/netzwerk" "Netzwerk ($($ns.Count))" 'folder' @{ kind = 'list'; col = 'netzwerk'; ids = @($ns | ForEach-Object { $_.id }); title = 'Netzwerk am Standort' }
      Add-LinkLeaves $n.Nodes "$key/netzwerk" 'netzwerk' $ns
    }
  }
}
function Rebuild-Tree {
  $expanded = New-Object System.Collections.Generic.HashSet[string]
  $walk = { param($nodes) foreach ($n in $nodes) { if ($n.IsExpanded) { [void]$expanded.Add($n.Name) }; & $walk $n.Nodes } }
  & $walk $tree.Nodes
  $selKey = if ($tree.SelectedNode) { $tree.SelectedNode.Name } else { 'root' }
  $script:Suppress = $true
  $tree.BeginUpdate()
  try {
    $tree.Nodes.Clear()
    $kname = [string]$script:D.kunde.name; if (-not $kname) { $kname = 'Neuer Kunde' }
    $root = Add-Node $tree.Nodes 'root' $kname 'folder' @{ kind = 'root' }
    foreach ($col in $ORDER) {
      $c = Add-Node $root.Nodes $col "$($SCH[$col].many) ($($script:D[$col].Count))" 'folder' @{ kind = 'col'; col = $col }
      foreach ($e in $script:D[$col]) { Build-Entity $c.Nodes $col $e (Key-Of $col $e.id) }
    }
    if ($expanded.Count -eq 0) { [void]$expanded.Add('root') }
    foreach ($k in $expanded) { $f = $tree.Nodes.Find($k, $true); if ($f.Count) { $f[0].Expand() } }
    $f = $tree.Nodes.Find($selKey, $true)
    $tree.SelectedNode = if ($f.Count) { $f[0] } else { $root }
  } finally { $tree.EndUpdate(); $script:Suppress = $false }
  Update-Address
}
function Select-Key($key) {
  $f = $tree.Nodes.Find($key, $true)
  if ($f.Count) { $tree.SelectedNode = $f[0]; $f[0].EnsureVisible() }
}
function Update-Address { if ($tree.SelectedNode) { $addr.Text = 'Computer\' + $tree.SelectedNode.FullPath } }
function Update-Title {
  $n = if ($script:FilePath) { [IO.Path]::GetFileName($script:FilePath) } else { 'Neue Bestandsaufnahme' }
  $form.Text = $(if ($script:Dirty) { '* ' } else { '' }) + $n + ' – Bestandsaufnahme IT-Hardware'
  $status.Text = $(if ($script:FilePath) { $script:FilePath } else { 'Noch nicht gespeichert' }) + $(if ($script:Dirty) { '   •   ungespeicherte Änderungen' } else { '' })
}

# =====================================================================
#  Rechte Seite
# =====================================================================
function New-Button($text, [scriptblock]$click) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text; $b.AutoSize = $true; $b.Height = 28; $b.Margin = New-Object System.Windows.Forms.Padding(6, 0, 0, 0)
  $b.add_Click($click); [void]$btnBar.Controls.Add($b); return $b
}
function Set-Header($kind, $title) { $lblKind.Text = $kind.ToUpper(); $lblTitle.Text = $title }
function Clear-Right { $body.Controls.Clear(); $btnBar.Controls.Clear() }
function New-Caption($text) {
  $l = New-Object System.Windows.Forms.Label; $l.Text = $text.ToUpper(); $l.Dock = 'Top'; $l.Height = 28
  $l.TextAlign = 'BottomLeft'; $l.ForeColor = $cGrey; $l.Font = New-Object System.Drawing.Font 'Segoe UI Semibold', 8.5
  return $l
}
# Name/Daten-Raster (wie im Registrierungs-Editor rechts)
function New-Grid($obj, $fields, $mode) {
  $g = New-Object System.Windows.Forms.DataGridView
  $g.AllowUserToAddRows = $false; $g.AllowUserToDeleteRows = $false; $g.RowHeadersVisible = $false
  $g.SelectionMode = 'CellSelect'; $g.EditMode = 'EditOnEnter'; $g.BackgroundColor = [System.Drawing.SystemColors]::Window
  $g.BorderStyle = 'None'; $g.AutoSizeRowsMode = 'None'; $g.RowTemplate.MinimumHeight = 24; $g.RowTemplate.Height = 24
  $g.AllowUserToResizeRows = $false; $g.AllowUserToResizeColumns = $false; $g.AllowUserToOrderColumns = $false
  $g.DefaultCellStyle.WrapMode = 'True'; $g.DefaultCellStyle.Alignment = 'TopLeft'; $g.DefaultCellStyle.Padding = New-Object System.Windows.Forms.Padding(2, 3, 2, 3); $g.ColumnHeadersHeightSizeMode = 'DisableResizing'
  $g.ColumnHeadersHeight = 26; $g.EnableHeadersVisualStyles = $true; $g.MultiSelect = $false
  $c1 = New-Object System.Windows.Forms.DataGridViewTextBoxColumn; $c1.HeaderText = 'Name'; $c1.ReadOnly = $true; $c1.Width = 230
  $c1.DefaultCellStyle.ForeColor = $cGrey
  $c2 = New-Object System.Windows.Forms.DataGridViewTextBoxColumn; $c2.HeaderText = 'Daten'; $c2.AutoSizeMode = 'Fill'
  [void]$g.Columns.Add($c1); [void]$g.Columns.Add($c2)
  foreach ($f in $fields) {
    $i = $g.Rows.Add(); $row = $g.Rows[$i]; $row.Tag = $f
    $row.Cells[0].Value = $f[1]
    $val = [string]$obj[$f[0]]
    if ($f[2] -eq 'select' -or $f[2] -eq 'ref') {
      $cb = New-Object System.Windows.Forms.DataGridViewComboBoxCell; $cb.FlatStyle = 'Flat'; $cb.DisplayStyle = 'DropDownButton'
      [void]$cb.Items.Add('')
      if ($f[2] -eq 'select') { foreach ($o in $f[3]) { [void]$cb.Items.Add($o) } }
      else { foreach ($o in $script:D[$f[3]]) { [void]$cb.Items.Add((Get-Title $f[3] $o)) }; $val = Get-Title $f[3] (Get-ById $f[3] $val); if ($val -eq '') { $val = '' } }
      if ($val -and -not $cb.Items.Contains($val)) { [void]$cb.Items.Add($val) }
      $row.Cells[1] = $cb; $cb.Value = $val
    } elseif ($f[2] -eq 'portdose') {
      # Dose gehört zum Switch-Port -> aus «Netzwerk» lesen
      if ($obj.switch -and (To-Int $obj.port) -gt 0) { $row.Cells[1].Value = [string](Get-PortInfo $obj.switch (To-Int $obj.port)).dose }
      else { $row.Cells[1].Value = ''; $row.Cells[1].ReadOnly = $true }
    } else { $row.Cells[1].Value = $val }
  }
  $g.Tag = @{ obj = $obj; mode = $mode }
  $g.add_DataError({ $_.ThrowException = $false })
  $g.add_CurrentCellDirtyStateChanged({ if ($this.IsCurrentCellDirty -and $this.CurrentCell -is [System.Windows.Forms.DataGridViewComboBoxCell]) { $this.CommitEdit('CurrentCellChange') | Out-Null } })
  $g.add_CellValueChanged({
      param($src, $e)
      if ($e.ColumnIndex -ne 1 -or $e.RowIndex -lt 0) { return }
      $row = $src.Rows[$e.RowIndex]; $f = $row.Tag; $v = [string]$row.Cells[1].Value; $t = $src.Tag
      $refreshView = $false
      if ($t.mode -eq 'port') { Set-PortValue $t.obj $f[0] $v }
      elseif ($f[2] -eq 'portdose') { Set-PortValue @{ _nid = $t.obj.switch; _p = (To-Int $t.obj.port) } 'dose' $v.Trim() }
      else {
        if (@('switch', 'port') -contains $f[0] -and @($src.Rows | Where-Object { $_.Tag[2] -eq 'portdose' }).Count) { $refreshView = $true }
        if ($f[2] -eq 'ref') { $ref = Find-ByTitle $f[3] $v; $v = if ($ref) { $ref.id } else { '' } }
        $t.obj[$f[0]] = $v.Trim()
      }
      Fit-Row $src $e.RowIndex ([string]$row.Cells[1].Value)
      Mark-Dirty
      if ($refreshView) { $form.BeginInvoke([System.Action] { Rebuild-Tree; Show-Node $tree.SelectedNode }) | Out-Null }
      else { $form.BeginInvoke([System.Action] { Rebuild-Tree; Refresh-HeaderTitle }) | Out-Null }
    })
  # Feld wächst beim Tippen mit (mehrzeilig, Zeilenumbruch)
  $g.add_EditingControlShowing({
      param($src, $e)
      $tb = $e.Control -as [System.Windows.Forms.TextBox]
      if ($tb) {
        $tb.Multiline = $true; $tb.WordWrap = $true; $tb.ScrollBars = 'None'
        $script:EditGrid = $src
        $form.BeginInvoke([System.Action] { if ($script:EditGrid -and $script:EditGrid.EditingControl) { Fit-EditRow $script:EditGrid.EditingControl } }) | Out-Null
        if ($tb.Tag -ne 'fit') {
          $tb.Tag = 'fit'
          $tb.add_TextChanged({ Fit-EditRow $this })
        }
      }
    })
  $g.ShowCellToolTips = $false
  # flimmerfrei zeichnen
  try { $g.GetType().GetProperty('DoubleBuffered', [System.Reflection.BindingFlags]'Instance, NonPublic').SetValue($g, $true, $null) } catch { }
  # Text selbst zeichnen: bricht wie ein Textfeld um, auch innerhalb langer Wörter
  $g.add_CellPainting({
      param($src, $e)
      if ($e.ColumnIndex -ne 1 -or $e.RowIndex -lt 0) { return }
      if ($src.Rows[$e.RowIndex].Cells[1] -is [System.Windows.Forms.DataGridViewComboBoxCell]) { return }
      $parts = [System.Windows.Forms.DataGridViewPaintParts]::All -bxor [System.Windows.Forms.DataGridViewPaintParts]::ContentForeground
      $e.Paint($e.CellBounds, $parts)
      $sel = ($e.State -band [System.Windows.Forms.DataGridViewElementStates]::Selected) -ne 0
      $col = if ($sel) { $e.CellStyle.SelectionForeColor } else { $e.CellStyle.ForeColor }
      $b = $e.CellBounds
      $rect = New-Object System.Drawing.Rectangle(($b.X + 5), ($b.Y + 5), [math]::Max(10, $b.Width - 10), [math]::Max(10, $b.Height - 7))
      [System.Windows.Forms.TextRenderer]::DrawText($e.Graphics, [string]$e.FormattedValue, $e.CellStyle.Font, $rect, $col, (Get-WrapFlags))
      $e.Handled = $true
    })
  $g.add_HandleCreated({ Fit-AllRows $this })
  $g.add_SizeChanged({ Fit-AllRows $this })
  return $g
}
function Get-WrapFlags { return [System.Windows.Forms.TextFormatFlags]'WordBreak, TextBoxControl, Left, Top, NoPrefix' }
# Zeilenhöhe passend zum Text berechnen (Text bricht in der Spalte «Daten» um)
function Fit-Row($g, $ri, $text) {
  if ($ri -lt 0 -or $ri -ge $g.Rows.Count -or $g.Columns.Count -lt 2) { return }
  $w = $g.Columns[1].Width - 10; if ($w -lt 40) { $w = 40 }
  $t = [string]$text; if (-not $t) { $t = 'X' }
  if ($t.EndsWith("`n")) { $t += 'X' }
  $sz = [System.Windows.Forms.TextRenderer]::MeasureText($t, $g.Font, (New-Object System.Drawing.Size($w, 0)), (Get-WrapFlags))
  $h = [int][math]::Max(24, $sz.Height + 12)
  if ($g.Rows[$ri].Height -ne $h) { $g.Rows[$ri].Height = $h }
}
# Während dem Tippen: Höhe nach den tatsächlichen Zeilen im Textfeld + eine Reservezeile
function Fit-EditRow($tb) {
  $gg = $tb.EditingControlDataGridView
  if (-not $gg -or -not $gg.CurrentCell) { return }
  $ri = $gg.CurrentCell.RowIndex
  $lines = 1
  if ($tb.TextLength -gt 0) { $lines = $tb.GetLineFromCharIndex($tb.TextLength) + 1 }
  if ($tb.Text.EndsWith("`n")) { $lines++ }
  $lh = [System.Windows.Forms.TextRenderer]::MeasureText('Xg', $tb.Font).Height
  $h = [int][math]::Max(24, ($lines + 1) * $lh + 8)
  $want = [math]::Max(10, $h - 4)
  # nur etwas tun, wenn sich die Zeilenzahl geändert hat (sonst flackert es)
  if ($gg.Rows[$ri].Height -eq $h -and $tb.Height -eq $want) { return }
  if ($gg.Rows[$ri].Height -ne $h) { $gg.Rows[$ri].Height = $h }
  if ($tb.Parent -and $tb.Parent.Height -ne ($h - 1)) { $tb.Parent.Height = $h - 1 }
  if ($tb.Height -ne $want) { $tb.Height = $want }
  $tb.ScrollToCaret()
}
function Fit-AllRows($g) {
  if ($script:FittingRows) { return }
  $script:FittingRows = $true
  try {
    for ($i = 0; $i -lt $g.Rows.Count; $i++) {
      if ($g.IsCurrentCellInEditMode -and $g.CurrentCell -and $g.CurrentCell.RowIndex -eq $i -and ($g.EditingControl -is [System.Windows.Forms.TextBox])) { Fit-EditRow $g.EditingControl; continue }
      Fit-Row $g $i ([string]$g.Rows[$i].Cells[1].FormattedValue)
    }
  } finally { $script:FittingRows = $false }
}
function Refresh-HeaderTitle {
  $t = $tree.SelectedNode.Tag
  if ($t.kind -eq 'entity') { $lblTitle.Text = Get-Title $t.col (Get-ById $t.col $t.id) }
  elseif ($t.kind -eq 'root') { $lblTitle.Text = $tree.Nodes[0].Text }
}
function New-LvItem($cells, $imageKey) {
  # Zeile für eine Liste: alle Zellen als Text, ohne SubItems.Add (robuster in Windows PowerShell)
  $arr = [string[]]@(@($cells) | ForEach-Object { if ($null -eq $_) { '' } else { [string]$_ } })
  $it = New-Object System.Windows.Forms.ListViewItem -ArgumentList (, $arr)
  if ($imageKey) { $it.ImageKey = $imageKey }
  return $it
}
function New-List($cols) {
  $lv = New-Object System.Windows.Forms.ListView
  $lv.View = 'Details'; $lv.FullRowSelect = $true; $lv.GridLines = $false; $lv.Dock = 'Fill'; $lv.BorderStyle = 'FixedSingle'
  $lv.SmallImageList = $images; $lv.HideSelection = $false
  foreach ($c in $cols) { [void]$lv.Columns.Add($c[0], $c[1]) }
  return $lv
}
$LISTCOLS = @{
  geraete = @(@('Name', 'name', 120), @('Typ', 'typ', 90), @('Modell', 'modell', 200), @('Raum', 'raum', 90), @('Garantie bis', 'garantie', 100))
  benutzer = @(@('Name', 'name', 180), @('Abteilung', 'abteilung', 120), @('E-Mail', 'email', 240))
  netzwerk = @(@('Name', 'name', 120), @('Kategorie', 'kategorie', 110), @('Modell', 'modell', 220), @('IP-Adresse', 'ip', 120))
  applikationen = @(@('Applikation', 'name', 200), @('Version', 'version', 90), @('Hersteller', 'hersteller', 140), @('Lizenzart', 'lizenzart', 110))
  lizenzen = @(@('Produkt', 'produkt', 240), @('Art', 'art', 90), @('Gekauft', 'gekauft', 70))
  standorte = @(@('Name', 'name', 180), @('Adresse', 'adresse', 240))
  postfaecher = @(@('Adresse', 'adresse', 240), @('Typ', 'typ', 130), @('Besitzer', 'besitzer', 140))
  monitore = @(@('Inventar-Nr.', 'inv', 110), @('Modell', 'modell', 200), @('Seriennummer', 'sn', 140), @('Anschluss', 'anschluss', 110))
}
function Show-EntityList($col, $items) {
  $cols = @($LISTCOLS[$col] | ForEach-Object { , @($_[0], $_[2]) })
  if ($col -eq 'geraete') { $cols += , @('Benutzer', 220) }
  if ($col -eq 'lizenzen') { $cols += , @('Zugewiesen', 80); $cols += , @('Frei', 60) }
  if ($col -eq 'benutzer') { $cols += , @('Geräte', 160) }
  $lv = New-List $cols
  foreach ($e in $items) {
    $vals = @($LISTCOLS[$col] | ForEach-Object { [string]$e[$_[1]] })
    if ($col -eq 'geraete') { $vals += ((List-Of $e.benutzer | ForEach-Object { Get-Title 'benutzer' (Get-ById 'benutzer' $_) }) -join ', ') }
    if ($col -eq 'lizenzen') { $z = Lic-Used $e; $vals += "$z"; $vals += "$((To-Int $e.gekauft) - $z)" }
    if ($col -eq 'benutzer') { $vals += ((Devices-OfUser $e.id | ForEach-Object { $_.name }) -join ', ') }
    $it = New-LvItem $vals $SCH[$col].icon
    $it.Tag = Key-Of $col $e.id
    if ($col -eq 'lizenzen' -and ((To-Int $e.gekauft) - (Lic-Used $e)) -lt 0) { $it.ForeColor = [System.Drawing.Color]::Firebrick }
    [void]$lv.Items.Add($it)
  }
  $lv.add_DoubleClick({ if ($this.SelectedItems.Count) { Select-Key $this.SelectedItems[0].Tag } })
  return $lv
}
function Get-Summary {
  $g = $script:D.geraete; $n = $script:D.netzwerk
  $cnt = { param($t) @($g | Where-Object { $_.typ -eq $t }).Count }
  $sw = @($n | Where-Object { $_.kategorie -eq 'Switch' } | ForEach-Object { Get-PortStats $_ })
  $sum = { param($k) $x = 0; foreach ($st in $sw) { $x += $st[$k] }; $x }
  $lk = 0; $lz = 0; foreach ($l in $script:D.lizenzen) { $lk += To-Int $l.gekauft; $lz += Lic-Used $l }
  return @(
    @('Standorte', $script:D.standorte.Count), @('Benutzer', $script:D.benutzer.Count), @('Geräte total', $g.Count),
    @('   davon NUC', (& $cnt 'NUC')), @('   davon Notebooks', (& $cnt 'Notebook')), @('   davon PCs / Thin Clients', ((& $cnt 'PC') + (& $cnt 'Thin Client'))),
    @('   davon Server', (& $cnt 'Server')), @('   davon Drucker', (& $cnt 'Drucker')), @('Monitore', $script:D.monitore.Count),
    @('Netzwerkkomponenten', $n.Count), @('   davon Switches', $sw.Count),
    @('   davon Router / Firewalls', @($n | Where-Object { $_.kategorie -eq 'Router' -or $_.kategorie -eq 'Firewall' }).Count),
    @('   davon Access Points', @($n | Where-Object { $_.kategorie -eq 'Access Point' }).Count),
    @('Switch-Ports gesamt', (& $sum 'total')), @('Switch-Ports gepatcht', (& $sum 'gepatcht')), @('Switch-Ports frei', (& $sum 'frei')), @('Switch-Ports defekt', (& $sum 'defekt')),
    @('Applikationen', $script:D.applikationen.Count), @('Shared Mailboxes', @($script:D.postfaecher | Where-Object { $_.typ -eq 'Shared Mailbox' }).Count),
    @('Lizenzen gekauft', $lk), @('Lizenzen zugewiesen', $lz), @('Lizenzen frei', ($lk - $lz)),
    @('Geräte mit abgelaufener Garantie', @($g | Where-Object { Is-Expired $_.garantie }).Count), @('Geräte im Zustand «ersetzen»', @($g | Where-Object { $_.zustand -eq 'ersetzen' }).Count))
}
function Fill-Body([System.Windows.Forms.Control[]]$topControls, $fill) {
  # Reihenfolge: Fill zuerst hinzufügen, dann die oberen Elemente in umgekehrter Reihenfolge
  if ($fill) { $body.Controls.Add($fill) }
  for ($i = $topControls.Count - 1; $i -ge 0; $i--) { $body.Controls.Add($topControls[$i]) }
}
# Tabelle genau so hoch wie ihre Zeilen; erst bei sehr viel Text (über ca. 60 % der Fensterhöhe) scrollen
function Fit-Grid($g) {
  $h = $g.ColumnHeadersHeight + $g.Rows.GetRowsHeight([System.Windows.Forms.DataGridViewElementStates]::None) + 3
  $max = [math]::Max(220, [int]($body.ClientSize.Height * 0.6))
  $new = [int][math]::Min($h, $max)
  if ($g.Height -ne $new) { $g.Height = $new }
}
function Sized-Grid($g) {
  $g.Dock = 'Top'; $g.ScrollBars = 'Vertical'
  Fit-Grid $g
  $g.add_RowHeightChanged({ Fit-Grid $this })
  $g.add_HandleCreated({ Fit-Grid $this })
  return $g
}

function Show-Node($node) {
  if (-not $node) { return }
  Update-Address
  Clear-Right
  $t = $node.Tag
  $miNeu.Enabled = $true; $miDel.Enabled = ($t.kind -eq 'entity' -and -not $t.focus)
  switch ($t.kind) {
    'root' {
      Set-Header 'Kunde' $node.Text
      $g = Sized-Grid (New-Grid $script:D.kunde $KUNDE 'obj')
      $lv = New-List @(@('Bereich', 260), @('Anzahl', 80))
      foreach ($r in Get-Summary) { [void]$lv.Items.Add((New-LvItem @($r[0], $r[1]) $null)) }
      $hint = New-Object System.Windows.Forms.Label; $hint.Dock = 'Top'; $hint.Height = 40; $hint.ForeColor = $cGrey
      $hint.Text = 'Links im Baum mit dem Pfeil auf- und zuklappen. Einen Ordner wählen (z.B. «Geräte») und «+ Neu» klicken oder Rechtsklick → Neu. Am Schluss Datei → Speichern im Kundenordner.'
      Fill-Body @($hint, (New-Caption 'Kundendaten'), $g, (New-Caption 'Zusammenfassung')) $lv
    }
    'col' {
      Set-Header 'Ordner' $SCH[$t.col].many
      New-Button ('+ Neu: ' + $SCH[$t.col].one) { New-Entity $tree.SelectedNode.Tag.col $null } | Out-Null
      Fill-Body @() (Show-EntityList $t.col $script:D[$t.col])
    }
    'list' {
      Set-Header 'Liste' $t.title
      Fill-Body @() (Show-EntityList $t.col @($t.ids | ForEach-Object { Get-ById $t.col $_ } | Where-Object { $_ }))
    }
    'entity' {
      $e = Get-ById $t.col $t.id; if (-not $e) { return }
      $fields = $SCH[$t.col].fields
      if ($t.focus -eq 'netz') { $fields = @($fields | Where-Object { @('ip', 'mac', 'switch', 'port') -contains $_[0] }) + @(, (F 'dose' 'Dose' 'portdose')); Set-Header 'Netzwerkanschluss' (Get-Title $t.col $e) }
      else { Set-Header $SCH[$t.col].one (Get-Title $t.col $e); New-Button 'Löschen' { Delete-Current } | Out-Null }
      if ($t.col -eq 'geraete' -and -not $t.focus) { New-Button '+ Monitor' { New-Monitor $tree.SelectedNode.Tag.id } | Out-Null }
      $g = New-Grid $e $fields 'obj'; $g.Dock = 'Fill'
      Fill-Body @() $g
    }
    'assign' {
      $owner = Get-ById $t.col $t.id
      Set-Header (Get-Title $t.col $owner) $SCH[$t.target].many
      New-Button ('+ Neu: ' + $SCH[$t.target].one) { $tt = $tree.SelectedNode.Tag; New-Entity $tt.target $tt } | Out-Null
      Fill-Body @((New-Caption "Anhaken, was zu $(Get-Title $t.col $owner) gehört")) (New-CheckList $t)
    }
    'reverse' {
      $owner = Get-ById $t.col $t.id
      Set-Header (Get-Title $t.col $owner) $node.Text
      Fill-Body @((New-Caption "Anhaken, wo «$(Get-Title $t.col $owner)» zugeordnet ist")) (New-CheckList $t)
    }
    'monitors' {
      $dev = Get-ById 'geraete' $t.id
      Set-Header $dev.name 'Monitore'
      New-Button '+ Monitor' { New-Monitor $tree.SelectedNode.Tag.id } | Out-Null
      Fill-Body @() (Show-EntityList 'monitore' @($script:D.monitore | Where-Object { $_.geraet -eq $t.id }))
    }
    'ports' {
      $n = Get-ById 'netzwerk' $t.id
      Set-Header $n.name 'Ports'
      $lv = New-List @(@('Port', 60), @('Gerät', 160), @('Status', 90), @('Dose', 100), @('Bemerkung', 240))
      foreach ($r in (Get-Ports $n)) {
        $devName = ''; if ($r.dev) { $devName = [string]$r.dev.name }
        $dose = ''; $bem = ''; if ($r.info) { $dose = [string]$r.info.dose; $bem = [string]$r.info.bemerkung }
        $it = New-LvItem @([string]$r.p, $devName, [string]$r.status, $dose, $bem) 'port'
        if ($r.status -eq 'defekt') { $it.ForeColor = [System.Drawing.Color]::Firebrick } elseif ($r.status -eq 'frei') { $it.ForeColor = [System.Drawing.Color]::SeaGreen }
        $it.Tag = (Key-Of 'netzwerk' $n.id) + "/ports/$($r.p)"; [void]$lv.Items.Add($it)
      }
      $lv.add_DoubleClick({ if ($this.SelectedItems.Count) { Select-Key $this.SelectedItems[0].Tag } })
      $hint = New-Object System.Windows.Forms.Label; $hint.Dock = 'Top'; $hint.Height = 22; $hint.ForeColor = $cGrey
      $hint.Text = 'Geräte werden beim Gerät über «Switch» und «Switch-Port» verbunden, oder hier über einen Port (Doppelklick).'
      Fill-Body @($hint) $lv
    }
    'port' {
      $n = Get-ById 'netzwerk' $t.id
      Set-Header $n.name "Port $($t.p)"
      $dev = $null; foreach ($gg in $script:D.geraete) { if ($gg.switch -eq $n.id -and (To-Int $gg.port) -eq $t.p) { $dev = $gg } }
      $i = Get-PortInfo $n.id $t.p
      $o = @{ dev = $(if ($dev) { $dev.id } else { '' }); status = [string]$i.status; dose = [string]$i.dose; bemerkung = [string]$i.bemerkung; _nid = $n.id; _p = $t.p }
      $fields = @((F 'dev' 'Angeschlossenes Gerät' 'ref' 'geraete'), (F 'status' 'Status (nur ohne Gerät)' 'select' @('defekt')), (F 'dose' 'Dose'), (F 'bemerkung' 'Bemerkung (z.B. Access Point, Uplink)'))
      $g = New-Grid $o $fields 'port'; $g.Dock = 'Fill'
      Fill-Body @() $g
    }
  }
}
function Set-PortValue($o, $k, $v) {
  $nid = $o._nid; $p = $o._p
  if ($k -eq 'dev') {
    foreach ($g in $script:D.geraete) { if ($g.switch -eq $nid -and (To-Int $g.port) -eq $p) { $g.switch = ''; $g.port = '' } }
    $dev = Find-ByTitle 'geraete' $v
    if ($dev) { $dev.switch = $nid; $dev.port = "$p" }
  } else {
    if (-not $script:D.portInfo[$nid]) { $script:D.portInfo[$nid] = @{} }
    $pi = $script:D.portInfo[$nid]["$p"]; if (-not $pi) { $pi = @{}; $script:D.portInfo[$nid]["$p"] = $pi }
    $pi[$k] = $v
  }
}
function New-CheckList($t) {
  $clb = New-Object System.Windows.Forms.CheckedListBox
  $clb.Dock = 'Fill'; $clb.CheckOnClick = $true; $clb.BorderStyle = 'FixedSingle'; $clb.IntegralHeight = $false
  $ids = New-Object System.Collections.ArrayList
  foreach ($x in $script:D[$t.target]) {
    if ($t.target -eq 'lizenzen' -and $t.col -eq 'geraete' -and -not (Lic-ForDevices $x)) { continue }
    if ($t.target -eq 'lizenzen' -and $t.col -eq 'benutzer' -and -not (Lic-ForUsers $x)) { continue }
    $on = if ($t.kind -eq 'assign') { (List-Of (Get-ById $t.col $t.id)[$t.field]) -contains $x.id } else { (List-Of $x[$t.field]) -contains $t.id }
    [void]$clb.Items.Add((Get-Title $t.target $x), [bool]$on); [void]$ids.Add($x.id)
  }
  $clb.Tag = @{ t = $t; ids = $ids }
  $clb.add_ItemCheck({
      param($src, $e)
      $t = $src.Tag.t; $id = $src.Tag.ids[$e.Index]; $on = ($e.NewValue -eq 'Checked')
      if ($t.kind -eq 'assign') { $obj = Get-ById $t.col $t.id; $other = $id } else { $obj = Get-ById $t.target $id; $other = $t.id }
      $list = @(List-Of $obj[$t.field] | Where-Object { $_ -ne $other }); if ($on) { $list += $other }
      $obj[$t.field] = $list
      Mark-Dirty
      $form.BeginInvoke([System.Action] { Rebuild-Tree }) | Out-Null
    })
  if ($clb.Items.Count -eq 0) {
    $l = New-Object System.Windows.Forms.Label; $l.Dock = 'Fill'; $l.ForeColor = $cGrey
    $l.Text = "Noch keine $($SCH[$t.target].many) erfasst. Mit «+ Neu» oben rechts anlegen."
    return $l
  }
  return $clb
}

# =====================================================================
#  Aktionen
# =====================================================================
function New-Entity($col, $assignTag) {
  $e = @{ id = (New-Id) }
  $e[$SCH[$col].fields[0][0]] = 'Neu: ' + $SCH[$col].one
  if ($col -eq 'geraete') { $e.benutzer = @(); $e.apps = @(); $e.lizenzen = @() }
  if ($col -eq 'benutzer') { $e.lizenzen = @() }
  [void]$script:D[$col].Add($e)
  if ($assignTag -and $assignTag.kind -eq 'assign') { $o = Get-ById $assignTag.col $assignTag.id; $o[$assignTag.field] = @(List-Of $o[$assignTag.field]) + $e.id }
  Mark-Dirty; Rebuild-Tree
  Select-Key (Key-Of $col $e.id)
  Focus-FirstValue
}
function New-Monitor($gid) {
  $m = @{ id = (New-Id); inv = 'MON-'; geraet = $gid }
  [void]$script:D.monitore.Add($m); Mark-Dirty; Rebuild-Tree
  Select-Key ((Key-Of 'geraete' $gid) + '/monitore/' + $m.id); Focus-FirstValue
}
function Focus-FirstValue {
  $g = $body.Controls | Where-Object { $_ -is [System.Windows.Forms.DataGridView] } | Select-Object -First 1
  if ($g -and $g.Rows.Count) { $g.Focus() | Out-Null; $g.CurrentCell = $g.Rows[0].Cells[1]; $g.BeginEdit($true) | Out-Null }
}
function New-InCurrent {
  $t = $tree.SelectedNode.Tag
  switch ($t.kind) {
    'col' { New-Entity $t.col $null }
    'assign' { New-Entity $t.target $t }
    'monitors' { New-Monitor $t.id }
    'entity' { if ($t.col -eq 'monitore') { $m = Get-ById 'monitore' $t.id; New-Monitor $m.geraet } else { New-Entity $t.col $null } }
    default { [System.Windows.Forms.MessageBox]::Show('Zuerst links einen Ordner wählen, z.B. «Geräte» oder «Benutzer».', 'Neuer Eintrag') | Out-Null }
  }
}
function Delete-Current {
  $t = $tree.SelectedNode.Tag
  if ($t.kind -ne 'entity' -or $t.focus) { return }
  $e = Get-ById $t.col $t.id
  $r = [System.Windows.Forms.MessageBox]::Show("«$(Get-Title $t.col $e)» löschen?`n`nVerknüpfungen zu diesem Eintrag werden ebenfalls entfernt.", 'Löschen', 'YesNo', 'Warning')
  if ($r -ne 'Yes') { return }
  $id = $t.id
  $script:D[$t.col].Remove($e)
  switch ($t.col) {
    'benutzer' { foreach ($g in $script:D.geraete) { $g.benutzer = @(List-Of $g.benutzer | Where-Object { $_ -ne $id }) } }
    'applikationen' { foreach ($g in $script:D.geraete) { $g.apps = @(List-Of $g.apps | Where-Object { $_ -ne $id }) } }
    'lizenzen' { foreach ($u in @($script:D.benutzer) + @($script:D.geraete)) { $u.lizenzen = @(List-Of $u.lizenzen | Where-Object { $_ -ne $id }) } }
    'geraete' { foreach ($m in @($script:D.monitore)) { if ($m.geraet -eq $id) { $m.geraet = '' } } }
    'netzwerk' { foreach ($g in $script:D.geraete) { if ($g.switch -eq $id) { $g.switch = ''; $g.port = '' } }; $script:D.portInfo.Remove($id) }
    'standorte' { foreach ($x in @($script:D.geraete) + @($script:D.netzwerk)) { if ($x.standort -eq $id) { $x.standort = '' } } }
  }
  $parent = $tree.SelectedNode.Parent
  if ($parent) { $tree.SelectedNode = $parent }
  Mark-Dirty; Rebuild-Tree; Show-Node $tree.SelectedNode
}
function New-Document {
  $script:D = New-Data; $script:FilePath = ''; $script:Dirty = $false
  $tree.Nodes.Clear(); Rebuild-Tree; $tree.Nodes[0].Expand(); Show-Node $tree.Nodes[0]; Update-Title
}
function Open-Dialog {
  if (-not (Confirm-Discard)) { return }
  $dlg = New-Object System.Windows.Forms.OpenFileDialog
  $dlg.Filter = 'Bestandsaufnahme (*.bestand;*.json)|*.bestand;*.json|Alle Dateien (*.*)|*.*'
  if ($dlg.ShowDialog($form) -eq 'OK') { Load-File $dlg.FileName }
}
# ---------------------------------------------------------------------
#  Excel-Export: eine .xlsx-Datei mit mehreren Blättern.
#  Wird direkt geschrieben, Excel muss dafür nicht installiert sein.
# ---------------------------------------------------------------------
function Ttl($c, $id) { if (-not $id) { return '' }; return Get-Title $c (Get-ById $c $id) }
function Names-Of($c, $ids) { return ((List-Of $ids | ForEach-Object { Ttl $c $_ }) -join ', ') }
function Join-Parts($parts) { return ((@($parts) | Where-Object { $_ -and ([string]$_).Trim() }) -join '  ·  ') }
function Num-Or-Text($v) { $r = 0; if ([int]::TryParse([string]$v, [ref]$r) -and ([string]$v).Trim() -notmatch '^0\d') { return $r }; return [string]$v }

function Get-ExportTables {
  $T = [ordered]@{}
  function Add-Tbl($name, $items, [scriptblock]$map) {
    $cols = @((& $map @{}).Keys)
    $rows = @(foreach ($it in @($items)) { if ($null -ne $it) { , @((& $map $it).Values) } })
    $T[$name] = @{ cols = $cols; rows = $rows }
  }
  Add-Tbl 'Geräte' $script:D.geraete { param($g) [ordered]@{
      'Name' = $g.name; 'Typ' = $g.typ; 'Hersteller / Modell' = $g.modell; 'Seriennummer' = $g.sn
      'Standort' = (Ttl 'standorte' $g.standort); 'Raum' = $g.raum
      'Benutzer' = (Names-Of 'benutzer' $g.benutzer); 'Applikationen' = (Names-Of 'applikationen' $g.apps); 'Lizenzen' = (Names-Of 'lizenzen' $g.lizenzen)
      'Monitore' = ((@($script:D.monitore | Where-Object { $g.id -and $_.geraet -eq $g.id }) | ForEach-Object { Get-Title 'monitore' $_ }) -join ', ')
      'Switch / Port' = $(if ($g.switch) { "$(Ttl 'netzwerk' $g.switch) / Port $($g.port)" } else { '' })
      'Dose' = $(if ($g.switch -and (To-Int $g.port) -gt 0) { [string](Get-PortInfo $g.switch (To-Int $g.port)).dose } else { '' })
      'IP-Adresse' = $g.ip; 'MAC-Adresse' = $g.mac; 'Lieferdatum' = $g.lieferdatum; 'Garantie bis' = $g.garantie; 'Zustand' = $g.zustand; 'Bemerkung' = $g.bemerkung } }
  Add-Tbl 'Benutzer' $script:D.benutzer { param($u) [ordered]@{
      'Name' = $u.name; 'Benutzername' = $u.login; 'Abteilung' = $u.abteilung; 'Funktion' = $u.funktion; 'E-Mail' = $u.email
      'Geräte' = $(if ($u.id) { ((Devices-OfUser $u.id | ForEach-Object { $_.name }) -join ', ') } else { '' }); 'Lizenzen' = (Names-Of 'lizenzen' $u.lizenzen)
      'MFA' = $u.mfa; 'Admin-Rechte' = $u.admin; 'Bemerkung' = $u.bemerkung } }
  Add-Tbl 'Lizenzen' $script:D.lizenzen { param($l) $z = $(if ($l.id) { Lic-Used $l } else { '' }); [ordered]@{
      'Lizenztyp / Produkt' = $l.produkt; 'Lizenzart' = $l.art; 'Gekauft' = (Num-Or-Text $l.gekauft); 'Zugewiesen' = $z
      'Frei' = $(if ($l.id) { (To-Int $l.gekauft) - $z } else { '' })
      'Benutzer' = $(if ($l.id) { ((Users-WithLic $l.id | ForEach-Object { $_.name }) -join ', ') } else { '' })
      'Geräte' = $(if ($l.id) { ((Devices-WithLic $l.id | ForEach-Object { $_.name }) -join ', ') } else { '' })
      'Laufzeit / Erneuerung' = $l.laufzeit; 'Bemerkung' = $l.bemerkung } }
  Add-Tbl 'Applikationen' $script:D.applikationen { param($a) [ordered]@{
      'Applikation' = $a.name; 'Version' = $a.version; 'Hersteller' = $a.hersteller; 'Lizenzart' = $a.lizenzart; 'Business-kritisch' = $a.kritisch
      'Installiert auf' = $(if ($a.id) { ((Devices-WithApp $a.id | ForEach-Object { $_.name }) -join ', ') } else { '' }) } }
  Add-Tbl 'Monitore' $script:D.monitore { param($m) [ordered]@{
      'Inventar-Nr.' = $m.inv; 'Hersteller / Modell' = $m.modell; 'Seriennummer' = $m.sn; 'Anschluss' = $m.anschluss; 'Angeschlossen an' = (Ttl 'geraete' $m.geraet) } }
  Add-Tbl 'Netzwerk' $script:D.netzwerk { param($n) $hasPorts = ($n.id -and (To-Int $n.ports) -gt 0); $ps = $(if ($hasPorts) { Get-PortStats $n } else { @{} }); [ordered]@{
      'Name' = $n.name; 'Kategorie' = $n.kategorie; 'Hersteller / Modell' = $n.modell; 'Seriennummer' = $n.sn; 'IP-Adresse' = $n.ip; 'MAC-Adresse' = $n.mac
      'Firmware' = $n.firmware; 'Standort' = (Ttl 'standorte' $n.standort); 'Raum / Rack' = $n.rack
      'Ports gesamt' = (Num-Or-Text $n.ports); 'Ports gepatcht' = $(if ($hasPorts) { $ps.gepatcht } else { '' }); 'Ports frei' = $(if ($hasPorts) { $ps.frei } else { '' }); 'Ports defekt' = $(if ($hasPorts) { $ps.defekt } else { '' })
      'Uplink zu' = $n.uplink; 'Garantie / Support bis' = $n.support; 'Bemerkung' = $n.bemerkung } }
  $portRows = @(foreach ($n in $script:D.netzwerk) { foreach ($r in (Get-Ports $n)) { [pscustomobject]@{ sw = $n; r = $r } } })
  Add-Tbl 'Ports' $portRows { param($x) [ordered]@{
      'Switch' = $(if ($x.sw) { $x.sw.name } else { '' }); 'Port' = $(if ($x.r) { $x.r.p } else { '' })
      'Angeschlossenes Gerät' = $(if ($x.r -and $x.r.dev) { $x.r.dev.name } else { '' }); 'Status' = $(if ($x.r) { $x.r.status } else { '' })
      'Dose' = $(if ($x.r) { $x.r.info.dose } else { '' }); 'Bemerkung' = $(if ($x.r) { $x.r.info.bemerkung } else { '' }) } }
  Add-Tbl 'Standorte' $script:D.standorte { param($s_) [ordered]@{
      'Name' = $s_.name; 'Adresse' = $s_.adresse; 'Räume' = $s_.raeume; 'Ansprechperson / Telefon / E-Mail' = $s_.kontakt; 'Serverraum / Rack' = $s_.serverraum
      'Geräte' = $(if ($s_.id) { ((@($script:D.geraete | Where-Object { $_.standort -eq $s_.id }) | ForEach-Object { $_.name }) -join ', ') } else { '' }) } }
  Add-Tbl 'Postfächer' $script:D.postfaecher { param($p) [ordered]@{
      'E-Mail-Adresse' = $p.adresse; 'Typ' = $p.typ; 'Besitzer' = $p.besitzer; 'Hosting' = $p.hosting } }
  return $T
}

# Zeilenstile: 1 Kopf, 2 Zelle, 3 Beschriftung, 4 Titel, 6 Baum Ebene 1, 7 Baum Ebene 2, 8 Zwischentitel, 9 Zahl
function XRow($vals, $style = 2, $lvl = 0) { return @{ v = @($vals); s = $style; lvl = $lvl } }

function Get-TreeRows {
  $rows = New-Object System.Collections.ArrayList
  $sec = { param($t) [void]$rows.Add((XRow @($t, '') 1 0)) }
  $l1 = { param($a, $b) [void]$rows.Add((XRow @($a, $b) 6 1)) }
  $l2 = { param($a, $b) if (-not $b) { $b = '–' }; [void]$rows.Add((XRow @($a, $b) @(7, 2) 2)) }
  & $sec "GERÄTE ($($script:D.geraete.Count))"
  foreach ($g in $script:D.geraete) {
    & $l1 (Get-Title 'geraete' $g) (Join-Parts @($g.typ, $g.modell, $(if ($g.sn) { "SN $($g.sn)" }), (Join-Parts @((Ttl 'standorte' $g.standort), $g.raum)), $(if ($g.garantie) { "Garantie bis $($g.garantie)" }), $g.zustand))
    & $l2 'Benutzer' (Names-Of 'benutzer' $g.benutzer)
    & $l2 'Applikationen' (Names-Of 'applikationen' $g.apps)
    & $l2 'Lizenzen' (Names-Of 'lizenzen' $g.lizenzen)
    & $l2 'Monitore' ((@($script:D.monitore | Where-Object { $_.geraet -eq $g.id }) | ForEach-Object { Join-Parts @($_.inv, $_.modell) }) -join ', ')
    & $l2 'Netzwerkanschluss' (Join-Parts @($(if ($g.switch) { "$(Ttl 'netzwerk' $g.switch) / Port $($g.port)" }), $(if ($g.switch -and (To-Int $g.port) -gt 0) { $dd = [string](Get-PortInfo $g.switch (To-Int $g.port)).dose; if ($dd) { "Dose $dd" } }), $(if ($g.ip) { "IP $($g.ip)" }), $(if ($g.mac) { "MAC $($g.mac)" })))
  }
  & $sec "BENUTZER ($($script:D.benutzer.Count))"
  foreach ($u in $script:D.benutzer) {
    & $l1 (Get-Title 'benutzer' $u) (Join-Parts @($u.abteilung, $u.funktion, $u.email, $(if ($u.mfa) { "MFA $($u.mfa)" }), $(if ($u.admin) { "Admin $($u.admin)" })))
    & $l2 'Geräte' ((Devices-OfUser $u.id | ForEach-Object { $_.name }) -join ', ')
    & $l2 'Lizenzen' (Names-Of 'lizenzen' $u.lizenzen)
  }
  & $sec "NETZWERK ($($script:D.netzwerk.Count))"
  foreach ($n in $script:D.netzwerk) {
    $info = @($n.kategorie, $n.modell, $(if ($n.ip) { "IP $($n.ip)" }), (Join-Parts @((Ttl 'standorte' $n.standort), $n.rack)))
    if ((To-Int $n.ports) -gt 0) { $ps = Get-PortStats $n; $info += "Ports: $($ps.total) gesamt, $($ps.gepatcht) gepatcht, $($ps.frei) frei, $($ps.defekt) defekt" }
    & $l1 (Get-Title 'netzwerk' $n) (Join-Parts $info)
    foreach ($r in (Get-Ports $n)) {
      & $l2 "Port $($r.p)" (Join-Parts @($(if ($r.dev) { $r.dev.name }), $r.status, $r.info.dose, $r.info.bemerkung))
    }
  }
  & $sec "APPLIKATIONEN ($($script:D.applikationen.Count))"
  foreach ($a in $script:D.applikationen) {
    & $l1 (Get-Title 'applikationen' $a) (Join-Parts @($(if ($a.version) { "Version $($a.version)" }), $a.hersteller, $a.lizenzart, $(if ($a.kritisch -eq 'Ja') { 'business-kritisch' })))
    & $l2 'Installiert auf' ((Devices-WithApp $a.id | ForEach-Object { $_.name }) -join ', ')
  }
  & $sec "LIZENZEN ($($script:D.lizenzen.Count))"
  foreach ($l in $script:D.lizenzen) {
    $z = Lic-Used $l
    & $l1 (Get-Title 'lizenzen' $l) (Join-Parts @($l.art, "gekauft $(To-Int $l.gekauft)", "zugewiesen $z", "frei $((To-Int $l.gekauft) - $z)", $(if ($l.laufzeit) { "Laufzeit $($l.laufzeit)" })))
    & $l2 'Benutzer' ((Users-WithLic $l.id | ForEach-Object { $_.name }) -join ', ')
    & $l2 'Geräte' ((Devices-WithLic $l.id | ForEach-Object { $_.name }) -join ', ')
  }
  & $sec "STANDORTE ($($script:D.standorte.Count))"
  foreach ($s_ in $script:D.standorte) {
    & $l1 (Get-Title 'standorte' $s_) (Join-Parts @($s_.adresse, $s_.raeume, $s_.kontakt))
    & $l2 'Geräte' ((@($script:D.geraete | Where-Object { $_.standort -eq $s_.id }) | ForEach-Object { $_.name }) -join ', ')
  }
  & $sec "POSTFÄCHER ($($script:D.postfaecher.Count))"
  foreach ($p in $script:D.postfaecher) { & $l1 (Get-Title 'postfaecher' $p) (Join-Parts @($p.typ, $p.besitzer, $p.hosting)) }
  return ,$rows
}

function Xml-Esc($v) { return [System.Security.SecurityElement]::Escape(([string]$v -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', '')) }
function Col-Letter([int]$i) { $s = ''; $i++; while ($i -gt 0) { $m = ($i - 1) % 26; $s = "$([char](65 + $m))$s"; $i = [int][math]::Floor(($i - 1) / 26) }; return $s }

function Sheet-Xml($sh) {
  $sb = New-Object System.Text.StringBuilder
  $rows = @($sh.rows)
  $ncol = 1; $maxLvl = 0
  foreach ($r in $rows) { if ($r.v.Count -gt $ncol) { $ncol = $r.v.Count }; if ($r.lvl -gt $maxLvl) { $maxLvl = $r.lvl } }
  [void]$sb.Append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">')
  [void]$sb.Append('<sheetPr><outlinePr summaryBelow="0"/></sheetPr>')
  if ($sh.freeze) {
    $fr = $sh.freeze + 1
    [void]$sb.Append("<sheetViews><sheetView workbookViewId=`"0`"$(if ($sh.first) { ' tabSelected="1"' })><pane ySplit=`"$($sh.freeze)`" topLeftCell=`"A$fr`" activePane=`"bottomLeft`" state=`"frozen`"/><selection pane=`"bottomLeft`" activeCell=`"A$fr`" sqref=`"A$fr`"/></sheetView></sheetViews>")
  } else { [void]$sb.Append("<sheetViews><sheetView workbookViewId=`"0`"$(if ($sh.first) { ' tabSelected="1"' })/></sheetViews>") }
  $olr = ''; if ($maxLvl) { $olr = ' outlineLevelRow="' + $maxLvl + '"' }
  [void]$sb.Append('<sheetFormatPr defaultRowHeight="15"' + $olr + '/>')
  [void]$sb.Append('<cols>')
  for ($c = 0; $c -lt $ncol; $c++) {
    $max = 8
    foreach ($r in $rows) { if ($c -lt $r.v.Count -and $r.s -ne 4) { $len = ([string]$r.v[$c]).Length; if ($c -eq 0) { $len += 3 * $r.lvl }; if ($len -gt $max) { $max = $len } } }
    if ($sh.widths -and $sh.widths[$c]) { $max = $sh.widths[$c] }
    $w = [math]::Min(70, $max + 3)
    [void]$sb.Append("<col min=`"$($c+1)`" max=`"$($c+1)`" width=`"$w`" customWidth=`"1`"/>")
  }
  [void]$sb.Append('</cols><sheetData>')
  $rn = 0
  foreach ($r in $rows) {
    $rn++
    $attr = if ($r.lvl) { " outlineLevel=`"$($r.lvl)`"" } else { '' }
    if ($r.s -eq 4) { $attr += ' ht="24" customHeight="1"' }
    [void]$sb.Append("<row r=`"$rn`"$attr>")
    for ($c = 0; $c -lt $r.v.Count; $c++) {
      $v = $r.v[$c]; $st = if ($r.s -is [array]) { $r.s[$c] } else { $r.s }
      $ref = "$(Col-Letter $c)$rn"
      if ($v -is [int] -or $v -is [long] -or $v -is [double]) {
        if ($st -eq 2) { $st = 9 }
        [void]$sb.Append("<c r=`"$ref`" s=`"$st`"><v>$v</v></c>")
      } elseif ($null -eq $v -or [string]$v -eq '') { [void]$sb.Append("<c r=`"$ref`" s=`"$st`"/>") }
      else { [void]$sb.Append("<c r=`"$ref`" s=`"$st`" t=`"inlineStr`"><is><t xml:space=`"preserve`">$(Xml-Esc $v)</t></is></c>") }
    }
    [void]$sb.Append('</row>')
  }
  [void]$sb.Append('</sheetData>')
  if ($sh.filter -and $rn -gt $sh.freeze) { [void]$sb.Append("<autoFilter ref=`"A$($sh.freeze):$(Col-Letter ($ncol - 1))$rn`"/>") }
  [void]$sb.Append('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" paperSize="9" fitToHeight="0"/>')
  [void]$sb.Append('</worksheet>')
  return $sb.ToString()
}

$XLSX_STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
'<fonts count="5"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FF1F3864"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF1F3864"/><name val="Arial"/></font></fonts>' +
'<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF1F6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
'<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>' +
'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10">' +
'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
'<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
'<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
'<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
'<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" indent="1" wrapText="1"/></xf>' +
'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" indent="3" wrapText="1"/></xf>' +
'<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>' +
'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'

function Write-Xlsx($path, $sheets) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  $enc = New-Object System.Text.UTF8Encoding($false)
  $zip = [System.IO.Compression.ZipFile]::Open($path, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    $put = { param($name, $text) $e = $zip.CreateEntry($name); $w = New-Object System.IO.StreamWriter($e.Open(), $enc); $w.Write($text); $w.Dispose() }
    $n = $sheets.Count
    $ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    for ($i = 1; $i -le $n; $i++) { $ct += "<Override PartName=`"/xl/worksheets/sheet$i.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml`"/>" }
    & $put '[Content_Types].xml' ($ct + '</Types>')
    & $put '_rels/.rels' '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    $wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>'
    $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    $names = ''
    for ($i = 0; $i -lt $n; $i++) {
      $sh = $sheets[$i]; $sh.first = ($i -eq 0)
      $wb += "<sheet name=`"$(Xml-Esc $sh.name)`" sheetId=`"$($i+1)`" r:id=`"rId$($i+1)`"/>"
      $rels += "<Relationship Id=`"rId$($i+1)`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet`" Target=`"worksheets/sheet$($i+1).xml`"/>"
      $cnt = @($sh.rows).Count
      if ($sh.filter -and $cnt -gt $sh.freeze) {
        $nc = 1; foreach ($r in $sh.rows) { if ($r.v.Count -gt $nc) { $nc = $r.v.Count } }
        $names += "<definedName name=`"_xlnm._FilterDatabase`" localSheetId=`"$i`" hidden=`"1`">'$(Xml-Esc $sh.name)'!`$A`$$($sh.freeze):`$$(Col-Letter ($nc - 1))`$$cnt</definedName>"
      }
      & $put "xl/worksheets/sheet$($i+1).xml" (Sheet-Xml $sh)
    }
    $wb += '</sheets>' + $(if ($names) { "<definedNames>$names</definedNames>" } else { '' }) + '</workbook>'
    $rels += "<Relationship Id=`"rId$($n+1)`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles`" Target=`"styles.xml`"/></Relationships>"
    & $put 'xl/workbook.xml' $wb
    & $put 'xl/_rels/workbook.xml.rels' $rels
    & $put 'xl/styles.xml' $XLSX_STYLES
  } finally { $zip.Dispose() }
}

function Build-ExcelSheets {
  $sheets = New-Object System.Collections.ArrayList
  $tables = Get-ExportTables
  # Übersicht
  $kname = [string]$script:D.kunde.name; if (-not $kname) { $kname = 'Kunde' }
  $r = New-Object System.Collections.ArrayList
  [void]$r.Add((XRow @("Bestandsaufnahme IT-Hardware – $kname") 4))
  [void]$r.Add((XRow @("Exportiert am $((Get-Date).ToString('dd.MM.yyyy HH:mm'))") 5))
  [void]$r.Add((XRow @('') 5))
  [void]$r.Add((XRow @('Kundendaten', '') 1))
  foreach ($f in $KUNDE) { [void]$r.Add((XRow @($f[1], [string]$script:D.kunde[$f[0]]) @(3, 2))) }
  [void]$r.Add((XRow @('') 5))
  [void]$r.Add((XRow @('Zusammenfassung', 'Anzahl') 1))
  foreach ($x in Get-Summary) { [void]$r.Add((XRow @($x[0].Trim(), [int]$x[1]) @(3, 9))) }
  [void]$r.Add((XRow @('') 5))
  [void]$r.Add((XRow @('Blatt', 'Was steht drin') 1))
  $guide = [ordered]@{
    'Baum' = 'Alles als Baum wie im Programm. Mit + / − links (oder den Knöpfen 1 2 3 oben links) auf- und zuklappen.'
    'Geräte' = 'Jedes Gerät mit Benutzern, Applikationen, Lizenzen, Monitoren und Switch-Port.'
    'Benutzer' = 'Jeder Benutzer mit seinen Geräten und Lizenzen.'
    'Lizenzen' = 'Gekauft / zugewiesen / frei, und an welche Benutzer und Geräte.'
    'Applikationen' = 'Jede Applikation und auf welchen Geräten sie installiert ist.'
    'Monitore' = 'Alle Monitore und an welchem Gerät sie hängen.'
    'Netzwerk' = 'Switches, Router, Firewalls, Access Points mit Port-Zahlen.'
    'Ports' = 'Jeder Switch-Port: welches Gerät, gepatcht / frei / defekt.'
    'Standorte' = 'Standorte mit Adresse und den Geräten dort.'
    'Postfächer' = 'Shared Mailboxes, Ressourcen und Verteilerlisten.'
  }
  foreach ($k in $guide.Keys) { [void]$r.Add((XRow @($k, $guide[$k]) @(3, 2))) }
  [void]$sheets.Add(@{ name = 'Übersicht'; rows = $r; freeze = 0; filter = $false; widths = @(36, 90) })
  # Baum
  $tr = New-Object System.Collections.ArrayList
  [void]$tr.Add((XRow @('Struktur', 'Details') 1))
  foreach ($x in (Get-TreeRows)) { [void]$tr.Add($x) }
  [void]$sheets.Add(@{ name = 'Baum'; rows = $tr; freeze = 1; filter = $false; widths = @(34, 100) })
  # Tabellen
  foreach ($k in $tables.Keys) {
    $t = $tables[$k]
    $rr = New-Object System.Collections.ArrayList
    [void]$rr.Add((XRow $t.cols 1))
    foreach ($row in $t.rows) { [void]$rr.Add((XRow $row 2)) }
    [void]$sheets.Add(@{ name = $k; rows = $rr; freeze = 1; filter = $true })
  }
  return ,$sheets
}

function Export-Excel {
  Commit-Edits
  $dlg = New-Object System.Windows.Forms.SaveFileDialog
  $dlg.Filter = 'Excel-Arbeitsmappe (*.xlsx)|*.xlsx'
  $name = ([string]$script:D.kunde.name) -replace '[\\/:*?"<>|]', '_'; if (-not $name) { $name = 'Kunde' }
  $dlg.FileName = "Bestandsaufnahme $name.xlsx"
  if ($script:FilePath) { $dlg.InitialDirectory = [IO.Path]::GetDirectoryName($script:FilePath) }
  if ($dlg.ShowDialog($form) -ne 'OK') { return }
  try {
    Write-Xlsx $dlg.FileName (Build-ExcelSheets)
    $r = [System.Windows.Forms.MessageBox]::Show("Gespeichert:`n$($dlg.FileName)`n`nJetzt öffnen?", 'Excel-Export', 'YesNo', 'Information')
    if ($r -eq 'Yes') { Start-Process -FilePath $dlg.FileName }
  } catch {
    [System.Windows.Forms.MessageBox]::Show("Export hat nicht geklappt.`n`n$($_.Exception.Message)`n`nIst die Datei vielleicht noch in Excel geöffnet?", 'Excel-Export', 'OK', 'Error') | Out-Null
  }
}

# =====================================================================
#  Dateityp .bestand registrieren (nur für diesen Windows-Benutzer, keine Adminrechte)
#  -> Doppelklick auf eine Kundendatei öffnet sie direkt in diesem Programm.
# =====================================================================
function Register-FileType {
  try {
    $script_ = $PSCommandPath
    if (-not $script_) { return }
    $cmd = "`"$env:windir\System32\WindowsPowerShell\v1.0\powershell.exe`" -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File `"$script_`" `"%1`""
    $base = 'HKCU:\Software\Classes'
    $cur = $null; try { $cur = (Get-ItemProperty -LiteralPath "$base\Bestandsaufnahme.Datei\shell\open\command" -ErrorAction Stop).'(default)' } catch { }
    if ($cur -eq $cmd) { return }
    New-Item -Path "$base\.bestand" -Force | Out-Null
    Set-Item -LiteralPath "$base\.bestand" -Value 'Bestandsaufnahme.Datei'
    New-Item -Path "$base\Bestandsaufnahme.Datei\DefaultIcon" -Force | Out-Null
    New-Item -Path "$base\Bestandsaufnahme.Datei\shell\open\command" -Force | Out-Null
    Set-Item -LiteralPath "$base\Bestandsaufnahme.Datei" -Value 'Bestandsaufnahme IT-Hardware'
    Set-Item -LiteralPath "$base\Bestandsaufnahme.Datei\DefaultIcon" -Value "$env:windir\regedit.exe,0"
    Set-Item -LiteralPath "$base\Bestandsaufnahme.Datei\shell\open\command" -Value $cmd
    try {
      Add-Type -Namespace BA -Name Shell -MemberDefinition '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, int f, System.IntPtr a, System.IntPtr b);'
      [BA.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
    } catch { }
  } catch { }
}

# =====================================================================
#  Ereignisse
# =====================================================================
$tree.add_AfterSelect({
    param($src, $e)
    if ($script:Suppress) { return }
    try { Show-Node $e.Node }
    catch {
      $status.Text = "Fehler (Zeile $($_.InvocationInfo.ScriptLineNumber)): $($_.Exception.Message)"
      [System.Windows.Forms.MessageBox]::Show("Diese Ansicht konnte nicht angezeigt werden.`n`n$($_.Exception.Message)`nZeile $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())`n`nDie Daten sind nicht betroffen.", 'Bestandsaufnahme', 'OK', 'Warning') | Out-Null
    }
  })
$tree.add_NodeMouseClick({ param($src, $e) if ($e.Button -eq 'Right') { $tree.SelectedNode = $e.Node } })
$ctx.add_Opening({
    $ctx.Items.Clear()
    $t = $tree.SelectedNode.Tag
    $label = switch ($t.kind) { 'col' { 'Neu: ' + $SCH[$t.col].one } 'assign' { 'Neu: ' + $SCH[$t.target].one } 'monitors' { 'Neu: Monitor' } 'entity' { if ($t.col -eq 'monitore') { 'Neu: Monitor' } elseif (-not $t.focus) { 'Neu: ' + $SCH[$t.col].one } } default { $null } }
    if ($label) { [void]$ctx.Items.Add($label, $null, { New-InCurrent }) }
    if ($t.kind -eq 'entity' -and -not $t.focus) { [void]$ctx.Items.Add('Löschen', $null, { Delete-Current }) }
    if ($tree.SelectedNode.Nodes.Count) { [void]$ctx.Items.Add('Alles darunter aufklappen', $null, { $tree.SelectedNode.ExpandAll() }) }
    $_.Cancel = ($ctx.Items.Count -eq 0)
  })
$tree.add_KeyDown({ param($src, $e) if ($e.KeyCode -eq 'Delete') { Delete-Current; $e.Handled = $true } })
$miDel.ShortcutKeyDisplayString = 'Entf'
$form.add_FormClosing({ param($src, $e) if (-not (Confirm-Discard)) { $e.Cancel = $true } })
$form.add_Shown({
    Register-FileType
    $split.SplitterDistance = 340
    if ($Datei -and (Test-Path -LiteralPath $Datei)) { Load-File (Resolve-Path -LiteralPath $Datei).Path } else { New-Document }
  })

$ErrorActionPreference = 'Continue'
[void]$form.ShowDialog()

