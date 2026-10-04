"""Regression checks for the send-time gate and envelope watcher."""
import struct
from types import SimpleNamespace
from OpenAgent.voice import RATE, gate_pcm
from OpenAgent.dispatcher import parse_tool_calls
from OpenAgent.replies import incoming_texts


def pcm(seconds, level=0):
    return struct.pack('<h', level) * int(RATE * seconds)


def test_gate_rejects_long_near_silence_even_on_hotkey():
    assert not gate_pcm(pcm(35, 100), source='hotkey')
    assert not gate_pcm(pcm(60, 100), source='voice', recognized=['noise'])


def test_gate_rejects_mostly_quiet_capture():
    assert not gate_pcm(pcm(20) + pcm(1, 1700) + pcm(2), source='hotkey')
    assert gate_pcm(pcm(2, 1800), source='hotkey')


def test_exact_envelope_in_ax_value():
    cfg = SimpleNamespace(message_list_path='/0/2', incoming_marker='Incoming message',
                          number='+16508702892', safe_mode=True)
    envelope = 'JARVIS_CALL:W3sidG9vbCI6ICJzeXN0ZW1faW5mbyIsICJhcmdzIjoge319LCB7InRvb2wiOiAiYXBwbGVzY3JpcHQiLCAiYXJncyI6IHsic2NyaXB0IjogImRpc3BsYXkgbm90aWZpY2F0aW9uIFwiSmFydmlzIGlzIG9ubGluZSwgc2lyLlwiIHdpdGggdGl0bGUgXCJKYXJ2aXNcIiJ9fV0=:END'
    rows = [
        {'path':'/0/2','role':'AXList','title':'','description':'','value':''},
        {'path':'/0/2/0','role':'AXGroup','title':'Incoming message','description':'','value':envelope},
    ]
    texts = incoming_texts(rows, cfg)
    assert len(texts) == 1
    assert [call['tool'] for call in parse_tool_calls(texts[0][1])] == ['system_info', 'applescript']
