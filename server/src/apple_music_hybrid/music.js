// Fixed operations only. Arguments are JSON data, never evaluated as program text.
function run(argv) {
  const request = JSON.parse(argv[0]);
  const music = Application('Music');
  const safe = (f, fallback) => { try { return f(); } catch (_) { return fallback; } };
  const track = t => ({source:'native', id:t.persistentID(), name:t.name(), artist:t.artist(),
    album:t.album(), duration_ms:Math.round(t.duration()*1000),
    genre:safe(()=>t.genre(),''), bpm:safe(()=>t.bpm(),0)});
  const playlist = p => ({source:'native', id:p.persistentID(), name:p.name(),
    smart:safe(()=>p.smart(),false), special_kind:safe(()=>p.specialKind(), 'none')});
  const byID = (collection, id) => {
    const found = collection.whose({persistentID:id})();
    if (found.length !== 1) throw new Error('Persistent ID did not identify exactly one item.');
    return found[0];
  };
  try {
    if (request.op === 'status' && !music.running()) return JSON.stringify({running:false,state:'stopped'});
    if (request.op === 'status') return JSON.stringify({running:true,state:music.playerState(),
      volume:music.soundVolume(),position:music.playerPosition(),
      shuffle:safe(()=>music.shuffleEnabled(),false),repeat:safe(()=>music.songRepeat(),'off'),
      track:safe(()=>track(music.currentTrack()),null)});
    if (request.op === 'playlists') {
      // One bulk Apple Event; avoid one round trip per playlist just to get properties.
      const props = music.userPlaylists.properties();
      return JSON.stringify({playlists:props.map(p=>({source:'native',id:p.persistentID,
        name:p.name,smart:p.smart,special_kind:p.specialKind}))});
    }
    if (request.op === 'playlist') {
      const p = byID(music.userPlaylists, request.id), count = p.tracks.length;
      if (count > 2000) throw new Error('Playlist exceeds the 2000-track safety limit.');
      return JSON.stringify({...playlist(p),tracks:p.tracks().map(track)});
    }
    const library = music.libraryPlaylists[0];
    if (request.op === 'tracks') return JSON.stringify({tracks:request.ids.map(id=>track(byID(library.tracks,id)))});
    if (request.op === 'search') {
      const found = request.query ? music.search(library,{for:request.query,only:'songs'}) : library.tracks();
      return JSON.stringify({total:found.length,offset:request.offset,
        tracks:found.slice(request.offset,request.offset+request.limit).map(track)});
    }
    throw new Error('Unknown native read operation.');
  } catch (err) { return JSON.stringify({error:String(err)}); }
}
