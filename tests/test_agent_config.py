from config_utils import has_active_mixin, has_model_config


def test_empty_mixin_is_not_treated_as_a_model():
    assert not has_active_mixin({"llm_nos": []})


def test_non_empty_mixin_is_preserved():
    assert has_active_mixin({"llm_nos": ["api_config"]})


def test_model_config_requires_connection_fields():
    assert has_model_config({"api_config": {"model": "demo", "apikey": "key", "apibase": "https://example.test"}})
    assert not has_model_config({"api_config": {"model": "demo", "apikey": "", "apibase": "https://example.test"}})
