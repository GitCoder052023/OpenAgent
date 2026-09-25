import pytest
from bridge.ax import verify_header
from bridge.desktop import Desktop
from bridge.config import Config
from bridge.replies import incoming

def test_header_requires_exact_path_and_number():
    rows=[{"path":"/0/1","role":"AXStaticText","title":"+1 (650) 870-2892","value":"","description":""}]
    assert verify_header(rows, "+16508702892", "/0/1")
    with pytest.raises(RuntimeError): verify_header(rows, "+16507096252", "/0/1")
    with pytest.raises(RuntimeError): verify_header(rows, "+16508702892", "/0/2")

def test_requires_calibration():
    with pytest.raises(RuntimeError): verify_header([], "+16508702892", "")
    with pytest.raises(RuntimeError): incoming([], "", "")

def test_reply_only_from_marked_group():
    rows=[
      {"path":"/0/2","role":"AXList","title":"","description":"","value":""},
      {"path":"/0/2/0","role":"AXGroup","title":"Incoming message","description":"","value":""},
      {"path":"/0/2/0/0","role":"AXStaticText","title":"","description":"","value":"Hello"},
      {"path":"/0/2/1","role":"AXGroup","title":"Outgoing message","description":"","value":""},
      {"path":"/0/2/1/0","role":"AXStaticText","title":"","description":"","value":"Secret"},
    ]
    assert incoming(rows,"/0/2","Incoming message") == [("/0/2/0", "Hello")]

def test_send_rejects_multiline():
    with pytest.raises(ValueError): Desktop(Config()).send("hello\nworld")
