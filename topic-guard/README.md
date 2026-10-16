<h1 align="center">🧭 topic-guard</h1>

<p align="center">
  A Claude Code mod that keeps one topic per session: a message that starts a separate topic can go to a new session before it enters this one.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdougcunha%2Fclaude-mods%2Fmain%2Ftopic-guard%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&color=blue" alt="Version">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Claude%20Code-2.1.301-d97757.svg" alt="Tested on Claude Code 2.1.301">
</p>

<p align="center">
  <a href="#-install">Install</a> ·
  <a href="#-use">Use</a> ·
  <a href="#-settings">Settings</a> ·
  <a href="#-limitations">Limitations</a> ·
  <a href="#-development">Development</a>
</p>

## ✨ What it does

A session that mixes topics carries context the next message does not need. This mod checks each message you type before it enters the session:

1. 🔎 **Judge:** a small model (Haiku by default) reads the end of the conversation and your new message, and decides `related` or `new-topic`. When it is not sure, it answers `related`.
2. ✋ **Hold:** a `new-topic` message does not enter the session, and Claude Code puts it back in the prompt box. A band above the prompt shows the reason, with a **New session** button.
3. 🔁 **Move or keep:** **New session** runs `/clear` and leaves your message in the prompt box of the new session: press Enter to send it there. Press Enter in this session instead to keep the message here.

<p align="center">
  <img src="images/band.png" width="640" alt="A held prompt: the transcript says the hook held it as a new topic, and a rounded band above the prompt box reads topic-guard, this looks like a new topic, 6% context, the model's reason, a New session button and the hint or press Enter to keep it here. The message is back in the prompt box.">
</p>

The band holds three lines in a quiet rounded frame, which lights up under the pointer:

- **Title:** `◇ topic-guard`, then `this looks like a new topic`, and on the right how full the context window is.
- **Reason:** the judging model's reason, in one sentence.
- **Action:** the **New session** button and the hint `or press Enter to keep it here`. While the mod clears the session, the frame reads `◌ topic-guard · clearing the session…`.

The mod never sends your message for you, so it enters as your own prompt, with its images and `@` mentions. A `related` message enters at once, as typed. The new session gets no handoff: a separate topic needs nothing from this conversation. To carry the work itself to a fresh session, use a tool made for it, such as ContextBrake.

The mod stands alone: it needs no other mod, skill or tool.

## 🚀 Install

At the Claude Code prompt:

```text
/plugin install topic-guard --marketplace dougcunha/claude-mods
```

Answer `y` to add the marketplace and choose a scope. If you already added the marketplace:

```text
/plugin install topic-guard@claude-mods
```

## 🎮 Use

| Action | How |
| --- | --- |
| Send a held message to a new session | Press **New session**, then Enter in the new session |
| Send a held message to this session | Press Enter again. The mod judges again only when the context grows by 10 more points |
| Drop a held message | Change or replace the text in the prompt box and send it. The mod judges the new text |

While the mod clears the session, the band says so. When the clear fails, the session stays as it was, the message stays in the prompt box, and a toast says so.

The mod judges only a prompt you type at an idle session. It lets these enter without a judgment:

- slash commands, and prompts from a plugin, Remote Control, a background task, a schedule or another session;
- a prompt typed while a turn runs, which belongs to that turn;
- a prompt to a session where the model has not answered yet, which has no topic: a fresh session, or one that holds only local commands such as `/clear` and `/reload-plugins`;
- every prompt while the context window is less than 20% full. Until the first answer of a fresh or just compacted session, the engine reports no figure, and the mod counts the context as 0%.

## 🔧 Settings

Set them in `/config`, under the mod's name.

| Option | Default | What it does |
| --- | --- | --- |
| `analyze` | `true` | Judge each prompt and hold a new topic. Off lets every prompt enter. |
| `model` | `haiku` | The model that judges a prompt: an alias or a full model id. The call goes through the session's own client. |
| `minContextPercent` | `20` | Judge a prompt only when the context window is at least this full. `0` judges every prompt. |
| `recheckStep` | `10` | After you keep a held message here, judge again only when the context grew by this many points. A context that drops below that point, as after a compact, is judged again at once. |
| `debug` | `false` | Write one line per judgment and choice to `<temp>/claude-topic-guard/<session id>/debug.log`: the time, the session id, the context percent and the outcome (`judge: related at 45%`, `judge: none at 0%`, `keep here at 7%`, `new session: done`). It never holds prompt or reply text. `<temp>` is `TEMP`, else `TMPDIR`, else `/tmp`. |

## 🚧 Limitations

- **Wait:** a judged prompt waits for the judging model, usually 1 to 3 seconds and at most 8. When the model fails or does not answer in time, the prompt enters as typed.
- **Cost:** each judged prompt is one call to the judging model, with up to 12,000 characters of the conversation and 4,000 of the new message.
- **Wrong judgments:** the model can take a short follow-up for a new topic. Press Enter again to send it on, and the mod stops asking until the context grows.
- **The new session:** the prompt box keeps its draft through `/clear`. After `/clear` the engine reports the old session id for about a second, so the mod waits up to 3 seconds for the new id, then puts the message back in the box only if the box is empty. An image pasted in a box that `/clear` emptied does not come back.
- **The band's state** lives in the session: `/clear`, a resume and a restart reset it. After a `/clear` the engine no longer redraws the band when the state changes, so the mod asks for a redraw after each change.
- **No automatic move:** the mod never clears a session without your press.

## 🔨 Development

```text
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

Run the manual check in a session you can lose: **New session** clears it.

<details>
<summary>🗂 Source files</summary>

| File | Role |
| --- | --- |
| `hooks/register.tsx` | The `prompt.submit` hook and the band |
| `hooks/judge.ts` | Which prompts to judge, the judging prompt, the transcript excerpt and the reply parser |
| `hooks/session.ts` | The move to a new session and the debug log path |
| `hooks/host.ts` | The engine calls the helper modules use |
| `types/index.d.ts` | The `$.state` contract |

</details>

## 📄 License

[MIT](../LICENSE)
