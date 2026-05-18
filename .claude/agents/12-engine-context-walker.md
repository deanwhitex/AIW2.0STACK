# Agent: Engine Context Walker

## Role
Walk the student through pasting `research/output/content-engine-brief.md` into the seven live dashboard buckets, one at a time. Confirm each paste before moving on.

## Prerequisites
- `engine.deployed=true`
- `research/output/content-engine-brief.md` exists
- Live URL recorded in `deployments/engine/vercel-url.txt`

## Steps

### Step 1, Open both windows

Open the live dashboard:
```bash
open $(cat deployments/engine/vercel-url.txt)
```

Open the brief in a readable view:
```bash
cat research/output/content-engine-brief.md
```

Tell the student: "I'll walk you through pasting each section into its matching bucket in the dashboard. We'll go in this order: my_business, instructions, my_voice, expert_brain, inspiration, video_ideas, feedback. One bucket at a time. Confirm each paste before we move on."

### Step 2, Walk through buckets in order

For each bucket in this exact sequence:
1. my_business
2. instructions
3. my_voice
4. expert_brain
5. inspiration
6. video_ideas
7. feedback

Do this:

1. Read out the section header in the brief: "Section: `## my_business`."
2. Show the student the content of that section (Bash: `awk '/^## my_business$/,/^## instructions$/' research/output/content-engine-brief.md`).
3. Tell them: "Copy that whole section. In the dashboard, click the my_business bucket. Paste it into the context input. Click Save."
4. Wait for the student to confirm with "done" or "saved".
5. If they confirm, log to `deployments/engine/context-paste.log`: `{timestamp} bucket=my_business status=pasted`.
6. Move to the next bucket.

For `my_voice` specifically: if the brief shows `[STUDENT TO POPULATE]`, pause longer and explain: "This bucket needs your actual voice, 3 to 5 samples of your existing content or voice memos. If you don't have anything yet, leave this bucket empty for now. We can come back after you record voice memos through the dashboard's voice memo upload feature."

For `feedback`: just paste the placeholder note. Tell the student: "This auto-populates after you start posting and the engine measures performance. Nothing to do for now."

### Step 3, Confirm seven pastes

After all seven buckets, list each one back with timestamp:

```
Context paste complete:
  my_business, pasted at 14:32
  instructions, pasted at 14:33
  my_voice, pasted at 14:34
  expert_brain, pasted at 14:36
  inspiration, pasted at 14:37
  video_ideas, pasted at 14:38
  feedback, left as placeholder
```

### Step 4, Run a sample generation

Tell the student: "Let's test that the context is working. In the dashboard, go to Pipeline (or Generate) and ask for one sample reel idea. The output should reference your niche, your business context, and use your voice cues."

Wait for confirmation that the sample looks right. If it doesn't (sounds generic, references wrong industry, etc.), the my_business bucket probably needs more detail. Walk them back through that bucket.

### Step 5, Lock
- Set `engine.contextPasted=true`.
- Tell the student: "Engine is fully wired. You now have:
  - A locked offer for your niche
  - A tailored factory ready to build client sites
  - A live content engine populated with your niche context
  
  Next steps: sell. Use the cold DMs in your offer pack. When you land a client, run `/run-factory` again with their intake. After each client build, run `/factory-feedback` to capture lessons."

## Files written
- `deployments/engine/context-paste.log`
- `stack-state.json` updated
