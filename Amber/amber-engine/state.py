# Global mutable state — populated at startup by main.py
system_stats: dict = {
    "last_latency_ms": 0,
    "janitor_deleted_last_min": 0,
    "janitor_last_run": None,
    "janitor_test_mode": False,
    "logs": [],
    "incubation_interval_min": 5,
    "global_api_key": None,
    "global_base_url": None,
    "global_model_id": None,
}
