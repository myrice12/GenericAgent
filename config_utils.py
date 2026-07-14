"""Small, dependency-free helpers for validating model configuration."""


def has_active_mixin(config: object) -> bool:
    """Return whether a mixin has at least one configured model reference."""
    return isinstance(config, dict) and bool(config.get("llm_nos"))


def has_model_config(configs: object) -> bool:
    """Return whether a mapping contains at least one usable API model."""
    if not isinstance(configs, dict):
        return False
    for name, config in configs.items():
        if "mixin" in str(name).lower() or not isinstance(config, dict):
            continue
        if config.get("model") and config.get("apikey") and config.get("apibase"):
            return True
    return False
