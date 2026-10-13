# OpenCode Terminal for DaVinci Resolve

**An embedded [OpenCode](https://opencode.ai) chat terminal for DaVinci Resolve, packaged as a Workflow Integration plugin.** It docks an OpenCode terminal to the right side of Resolve and automatically shrinks Resolve so the two never overlap.

**English** · [Português](#português) · [Български](#български)

---

## English

An embedded, fully interactive OpenCode terminal inside DaVinci Resolve. A Workflow Integration plugin adds **Workspace ▸ Workflow Integrations ▸ OpenCode Terminal**, which opens a right-side panel (1/5 of the screen) running `opencode` in a real terminal (xterm.js over a real PTY). Resolve is resized to the left so the panel never covers it, and Resolve is restored when you close the panel.

### Features
- **Embedded terminal** — xterm.js in an Electron panel, backed by a real PTY (`node-pty`), so the full OpenCode TUI works.
- **No overlap** — automatically resizes the Resolve window to the left and docks the chat in the freed space; restores Resolve on close/collapse.
- **Collapse to a ribbon** (`‹`), **restart session** (`⟳`), **close & restore** (`✕`).
- **No native rebuild** — the PTY runs under your **system Node**, so nothing has to be compiled against Resolve's bundled Electron.

### Requirements
- DaVinci Resolve **Studio** (Workflow Integrations are Studio-only)
- **Node.js** on `PATH` (the PTY sidecar runs under system Node)
- **opencode** on `PATH`

### Install

```powershell
git clone https://github.com/spacewalkingninja/davincicoded
cd davincicoded
powershell -ExecutionPolicy Bypass -File install.ps1
```

Then **restart DaVinci Resolve Studio** and open
**Workspace ▸ Workflow Integrations ▸ OpenCode Terminal**.

> If writing to `%PROGRAMDATA%` is denied, run the installer from an **elevated** PowerShell.

### Configuration (`config.json`, in the installed plugin folder)

`%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins\com.opencode.resolve.terminal\config.json`

| Key | Default | Meaning |
| --- | --- | --- |
| `shell` | `cmd.exe` | Shell spawned in the PTY |
| `command` | `opencode` | Command typed into the shell when the panel opens |
| `cwd` | user profile | Working directory for the OpenCode session |
| `panelFraction` | `0.2` | Panel width as a fraction of the screen (0.2 = 1/5) |
| `collapsedWidth` | `46` | Ribbon width in pixels |
| `startExpanded` | `true` | Open the terminal immediately instead of the collapsed ribbon |
| `resizeResolve` | `true` | Shrink Resolve to the left so the panel docks beside it (no overlap) |
| `alwaysOnTop` | `true` | Keep the panel above Resolve |
| `fontSize` | `13` | Terminal font size |
| `scrollback` | `5000` | Terminal scrollback lines |

### How it works

```
DaVinci Resolve Studio
  └─ Workspace ▸ Workflow Integrations ▸ OpenCode Terminal
        └─ Electron panel (main.js / preload.js / renderer.js — sandboxed, context-isolated)
              ├─ xterm.js  (renderer)
              ├─ winmgr.ps1 (Win32)  → resizes / restores the Resolve window
              └─ Node PTY sidecar (pty-server.js, system Node + node-pty) → shell → opencode
```

### Limitations (honest)
- A Workflow Integration **cannot** add a button to Resolve's native toolbar or dock a panel into Resolve's own layout — it always opens its **own** window. This plugin removes the overlap by resizing Resolve instead.
- **Studio only.**
- Do not use Resolve's **Full Screen Window** mode — a fullscreen window cannot be resized by the plugin.

### License
MIT

---

## Português

**Um terminal de chat OpenCode incorporado no DaVinci Resolve, empacotado como plugin de Workflow Integration.** Encaixa um terminal OpenCode no lado direito do Resolve e redimensiona automaticamente o Resolve para que nunca se sobreponham.

Um terminal OpenCode totalmente interativo dentro do DaVinci Resolve. O plugin adiciona **Workspace ▸ Workflow Integrations ▸ OpenCode Terminal**, que abre um painel à direita (1/5 do ecrã) a executar `opencode` num terminal real (xterm.js sobre um PTY real). O Resolve é redimensionado para a esquerda para que o painel nunca o tape, e o Resolve é restaurado quando fecha o painel.

### Funcionalidades
- **Terminal incorporado** — xterm.js num painel Electron, apoiado por um PTY real (`node-pty`), pelo que a interface TUI completa do OpenCode funciona.
- **Sem sobreposição** — redimensiona automaticamente a janela do Resolve para a esquerda e encaixa o chat no espaço libertado; restaura o Resolve ao fechar/recolher.
- **Recolher numa faixa** (`‹`), **reiniciar sessão** (`⟳`), **fechar e restaurar** (`✕`).
- **Sem compilação nativa** — o PTY corre no seu **Node do sistema**, por isso nada tem de ser compilado contra o Electron do Resolve.

### Requisitos
- DaVinci Resolve **Studio** (os Workflow Integrations são exclusivos da Studio)
- **Node.js** no `PATH` (o sidecar PTY corre sob o Node do sistema)
- **opencode** no `PATH`

### Instalação

```powershell
git clone https://github.com/spacewalkingninja/davincicoded
cd davincicoded
powershell -ExecutionPolicy Bypass -File install.ps1
```

Depois **reinicie o DaVinci Resolve Studio** e abra
**Workspace ▸ Workflow Integrations ▸ OpenCode Terminal**.

> Se a escrita em `%PROGRAMDATA%` for negada, execute o instalador num PowerShell **elevado**.

### Configuração (`config.json`, na pasta do plugin instalado)

Todas as opções estão descritas na tabela da secção **English**. As principais:
`command` (o comando executado, por omissão `opencode`), `cwd` (pasta de trabalho),
`panelFraction` (largura do painel, 0.2 = 1/5), `resizeResolve` (encolher o Resolve,
por omissão `true`) e `startExpanded` (abrir já expandido, por omissão `true`).

### Limitações
- Um Workflow Integration **não pode** adicionar um botão à barra de ferramentas nativa do Resolve nem encaixar um painel no layout do próprio Resolve — abre sempre a **sua própria** janela. Este plugin elimina a sobreposição redimensionando o Resolve.
- **Apenas Studio.**
- Não use o modo **Full Screen Window** do Resolve — uma janela em ecrã inteiro não pode ser redimensionada pelo plugin.

### Licença
MIT

---

## Български

**Вграден OpenCode чат терминал за DaVinci Resolve, оформен като добавка за Workflow Integration.** Той закрепва OpenCode терминал от дясната страна на Resolve и автоматично смалява Resolve, така че двата никога да не се застъпват.

Напълно интерактивен OpenCode терминал вътре в DaVinci Resolve. Добавката създава **Workspace ▸ Workflow Integrations ▸ OpenCode Terminal**, който отваря панел отдясно (1/5 от екрана) и стартира `opencode` в истински терминал (xterm.js върху истински PTY). Resolve се смалява наляво, за да не покрива панелът прозореца, и се възстановява при затваряне на панела.

### Възможности
- **Вграден терминал** — xterm.js в Electron панел върху истински PTY (`node-pty`), така че пълният OpenCode TUI работи.
- **Без застъпване** — автоматично смалява прозореца на Resolve наляво и закрепва чата в освободеното място; възстановява Resolve при затваряне/свиване.
- **Свиване до тънка лента** (`‹`), **рестартиране на сесията** (`⟳`), **затваряне и възстановяване** (`✕`).
- **Без компилиране** — PTY работи под **системния Node**, така че нищо не се компилира срещу Electron на Resolve.

### Изисквания
- DaVinci Resolve **Studio** (Workflow Integrations са само за Studio)
- **Node.js** в `PATH` (PTY процесът работи под системния Node)
- **opencode** в `PATH`

### Инсталация

```powershell
git clone https://github.com/spacewalkingninja/davincicoded
cd davincicoded
powershell -ExecutionPolicy Bypass -File install.ps1
```

След това **рестартирайте DaVinci Resolve Studio** и отворете
**Workspace ▸ Workflow Integrations ▸ OpenCode Terminal**.

> Ако записът в `%PROGRAMDATA%` бъде отказан, стартирайте инсталатора от **повдигнат** (elevated) PowerShell.

### Конфигурация (`config.json`, в папката на инсталираната добавка)

Всички опции са описани в таблицата в секцията **English**. Основните:
`command` (командата за стартиране, по подразбиране `opencode`), `cwd` (работна папка),
`panelFraction` (ширина на панела, 0.2 = 1/5), `resizeResolve` (смаляване на Resolve,
по подразбиране `true`) и `startExpanded` (отваряне веднага разгънат, по подразбиране `true`).

### Ограничения
- Една Workflow Integration добавка **не може** да добави бутон към нативната лента с инструменти на Resolve, нито да закрепи панел в самото оформление на Resolve — винаги се отваря **собствен** прозорец. Тази добавка премахва застъпването чрез смаляване на Resolve.
- **Само Studio.**
- Не използвайте режима **Full Screen Window** на Resolve — прозорец на цял екран не може да бъде преоразмерен от добавката.

### Лиценз
MIT
