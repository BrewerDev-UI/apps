# Brain → Obsidian vault patch (for index.html and brain.html)

Written by the vault thread. The Home Base redesign thread owns index.html and brain.html, so these changes are here for that thread to apply. Apply the same three edits to both files.

## What it does

Adds a `save_brain_dump` tool to the Brain. When the user dumps thoughts ("brain dump: …"), the Brain saves each dump as a new Markdown note in the **Inbox** folder of the user's Google Drive vault "Brain Dump Vault", through the viewer's Google Drive connector (`create_file`, new files only, nothing edited, moved or shared). Obsidian on their computer sees the notes through Google Drive for desktop.

If Google Drive can't be reached (the saved iPhone version has no connectors, or the call fails), the dump is pinned as a Today note starting with "Brain dump:" so nothing is lost. Claude can move those into the vault later.

Drive ids (user's own Drive, created Nov 2, 2026):
- Vault folder "Brain Dump Vault": `1iCsTN4RhCo6O9i5N3GhL2I5pvmXUbver`
- Inbox folder: `1duiCT632fzapBVj9c_ulPNg-lnwnRGsC`

## Edit 1: constants (next to `const GC='Google Calendar';`)

```js
const GD='Google Drive';const VAULT_INBOX='1duiCT632fzapBVj9c_ulPNg-lnwnRGsC';
function dumpFileName(title){const d=new Date();
  const stamp=today()+' '+pad(d.getHours())+pad(d.getMinutes());
  const clean=String(title||'Brain dump').replace(/[\\/:*?"<>|#^\[\]\n\r\t]/g,' ').replace(/\s+/g,' ').trim().slice(0,60)||'Brain dump';
  return stamp+' '+clean+'.md';}
function dumpMarkdown(i){const d=new Date();
  const tags=['brain-dump'].concat((i.tags||[]).map(t=>String(t).toLowerCase().replace(/[^a-z0-9_-]+/g,'-')).filter(Boolean));
  return '---\ncreated: '+today()+'T'+pad(d.getHours())+':'+pad(d.getMinutes())+'\nsource: Home Base Brain\ntags: ['+tags.join(', ')+']\n---\n# '+(i.title||'Brain dump')+'\n\n'+String(i.text||'').trim()+'\n';}
```

## Edit 2: add this tool to `BRAIN_TOOLS` (right after `add_note`)

```js
  {name:'save_brain_dump',description:'Save a brain dump to their Obsidian vault Inbox in Google Drive as a new note. Use for any brain dump, stream of thoughts, journal-style entry or "write this down" that is more than a quick pinned note. Keep their words; tidy into short lines or bullets only. title is 2 to 6 words. tags are optional single words like bakery, home, school, idea.',
    inputSchema:{type:'object',properties:{text:{type:'string'},title:{type:'string'},tags:{type:'array',items:{type:'string'}}},required:['text']},
    execute:async(i)=>{const name=dumpFileName(i.title);
      const fallback=async(why)=>{const id='hb-'+uid();const e=await change('Saved a brain dump','notes',id,()=>Store.put('notes',id,{text:'Brain dump: '+String(i.text).trim(),at:new Date().toISOString(),dump:true}),{silent:true});
        return e?did('Couldn’t reach your vault ('+why+'), so I pinned it on Today as “Brain dump”',e)+'. Tell them it’s pinned on Today and Claude can move it into the vault later.':'Could not save.';};
      if(!S.cap.mcp)return fallback('Google Drive only works inside Claude');
      try{await S.cap.mcp.callTool(GD,'create_file',{title:name,parentId:VAULT_INBOX,contentMimeType:'text/markdown',disableConversionToGoogleType:true,textContent:dumpMarkdown(i)});
        Snd.play('done');S.brain.msgs.push({role:'did',text:'Saved to your vault Inbox: '+name.replace(/\.md$/,'')});renderBrain();return 'Saved to the Obsidian vault Inbox as “'+name+'”.';}
      catch(e){const c=e&&e.code;
        const why=c==='server_not_connected'?'Google Drive isn’t connected':c==='needs_reauth'?'Google Drive needs reconnecting':c==='not_in_manifest'||c==='approval_required'?'Google Drive isn’t allowed for this page yet':'Google Drive didn’t answer';
        /* server_unavailable / upstream_error are ambiguous for writes: the note may exist. Don't retry; pin a copy so nothing is lost. */
        return fallback(why);}}},
```

## Edit 3: one sentence in `brainSystem()`

Replace

`Quick thoughts, ideas and to-dos that fit nowhere else go in add_note.`

with

`Quick one-line reminders that should show on Today go in add_note. Brain dumps, streams of thoughts and anything they say to "dump", "jot down" or "write down" go in save_brain_dump, which saves a note to their Obsidian vault.`

## Capability declaration on republish

The page's `mcp` manifest needs one more server entry, alongside the existing Google Calendar and Home Assistant entries:

```json
{"server": "Google Drive", "tools": ["create_file"]}
```

Republishing with a non-empty `capabilities` object replaces the whole set, so keep every existing capability and server entry and add this one. The viewer is asked once to allow Google Drive the first time the Brain saves a dump.

## Checked

- `create_file` argument names come from this session's Google Drive connector schema (`title`, `parentId`, `contentMimeType`, `disableConversionToGoogleType`, `textContent`), and the same call shape created the vault's starter notes as real `.md` files.
- Not run inside the published page yet, since that waits on the redesign thread's republish.
