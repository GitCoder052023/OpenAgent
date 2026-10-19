"""Regression checks: awake capture must not drop real messages that mention Jarvis."""
from OpenAgent.voice import VoiceState, _bare_wake_or_confirm, normalized, request_after_wake


def awake_state():
    st = VoiceState()
    st.accept("wakeup jarvis", now=1.0)
    assert st.awake
    return st


def test_bare_wake_phrases_still_ignored_while_awake():
    st = awake_state()
    assert st.accept("wake up jarvis", now=2.0) == "ignore"
    assert st.accept("Jarvis", now=2.5) == "ignore"
    assert st.accept("hey jarvis", now=3.0) == "ignore"
    assert st.accept("okay jarvis", now=3.5) == "ignore"


def test_message_mentioning_jarvis_is_sent():
    st = awake_state()
    assert st.accept("jarvis what time is it", now=2.0) == "send"
    assert st.accept("tell jarvis mode to wait", now=2.5) == "send"


def test_merged_wake_phrase_and_message_is_sent():
    # Whisper can return the wake phrase and the request in one utterance;
    # the request must survive.
    st = awake_state()
    assert st.accept("wake up jarvis tell me a story about space", now=2.0) == "send"
    st2 = awake_state()
    assert st2.accept("wake up jarvis bro jab meri voice note complete ho ja rahi hai", now=2.0) == "send"


def test_wake_echo_with_one_filler_still_ignored():
    st = awake_state()
    assert st.accept("wake up jarvis uh", now=2.0) == "ignore"


def test_bare_wake_or_confirm_helper():
    assert _bare_wake_or_confirm(normalized("wakeup jarvis"))
    assert _bare_wake_or_confirm(normalized("jarvis"))
    assert _bare_wake_or_confirm(normalized("confirm"))
    assert _bare_wake_or_confirm(normalized("wake up jarvis um"))
    assert not _bare_wake_or_confirm(normalized("jarvis what time is it"))
    assert not _bare_wake_or_confirm(normalized("wake up jarvis tell me a story"))
    assert not _bare_wake_or_confirm(normalized("this is a normal message"))


def test_sleep_still_requires_two_steps():
    st = awake_state()
    assert st.accept("jarvis stand by", now=2.0) == "sleep_prompt"
    assert st.accept("confirm stand by jarvis", now=3.0) == "sleep"
    assert not st.awake


def test_sleep_confirm_expires():
    st = awake_state()
    assert st.accept("jarvis stand by", now=2.0) == "sleep_prompt"
    # Window passed: no sleep; "stand by" re-arms the prompt instead (pre-existing).
    assert st.accept("confirm stand by jarvis", now=20.0) == "sleep_prompt"
    assert st.awake


def test_wake_from_sleep():
    st = VoiceState()
    assert st.accept("hello there", now=1.0) == "ignore"
    assert st.accept("wakeup jarvis", now=2.0) == "wake"


def test_request_spoken_with_the_wake_phrase_is_recovered():
    # Whisper returns a whole utterance, so waking must not swallow the ask.
    assert request_after_wake("wake up jarvis run the test suite") == "run the test suite"
    assert request_after_wake("Hey Jarvis, post the results to Threads.") == "post the results to threads"


def test_bare_wake_phrase_carries_no_request():
    assert request_after_wake("wake up jarvis") == ""
    assert request_after_wake("hey jarvis") == ""
    assert request_after_wake("wake up jarvis uh") == ""
