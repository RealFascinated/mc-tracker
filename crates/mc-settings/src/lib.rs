mod derived;
mod registry;
mod setting_type;
mod store;

pub use derived::{
    chat_enabled, cors_origin_candidates, validate_www_origin, victoriametrics_base_url,
    victoriametrics_import_url, LLM_API_KEY_MASK, VITE_DEV_ORIGIN,
};
pub use registry::{validate_metrics_push_cron, SettingKey, SettingSideEffects};
pub use setting_type::{BooleanType, EnumType, IntegerType, SettingType, StringType};
pub use store::{SettingItem, SettingsError, SettingsStore, SharedSettingsStore};

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use setting_type::{BooleanType, IntegerType, SettingType};

    #[test]
    fn boolean_type_validates_and_round_trips() {
        let value = json!(true);
        BooleanType.validate(&value).unwrap();
        let stored = BooleanType.serialize_stored(&value).unwrap();
        assert_eq!(stored, "true");
        assert_eq!(BooleanType.parse_stored(&stored).unwrap(), value);
    }

    #[test]
    fn integer_type_accepts_json_number() {
        let value = json!(5000u64);
        IntegerType.validate(&value).unwrap();
        assert_eq!(IntegerType.parse_stored("5000").unwrap(), json!(5000u64));
    }

    #[test]
    fn secret_setting_masks_configured_value_in_list() {
        let store =
            SettingsStore::for_testing_with("development", &[("llm_api_key", json!("secret-key"))]);
        let rt = tokio::runtime::Runtime::new().unwrap();
        let items = rt.block_on(store.list_all());
        let api_key = items.iter().find(|item| item.key == "llm_api_key").unwrap();
        assert_eq!(api_key.value, json!("********"));
    }

    #[test]
    fn validate_cross_rejects_invalid_cron() {
        let store = SettingsStore::for_testing("development");
        let err = SettingKey::MetricsPushCron
            .validate_cross(&store, &json!("not-a-cron"))
            .unwrap_err();
        assert!(err.contains("metrics_push_cron"));
    }
}
