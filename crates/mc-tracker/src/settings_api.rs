use mc_api_types::{SettingResponse, SettingsListResponse};
use mc_settings::SettingItem;

pub fn to_setting_response(item: SettingItem) -> SettingResponse {
    SettingResponse {
        key: item.key,
        setting_type: item.setting_type,
        value: item.value,
        updated_at: item.updated_at,
    }
}

pub fn to_settings_list(items: Vec<SettingItem>) -> SettingsListResponse {
    SettingsListResponse {
        settings: items.into_iter().map(to_setting_response).collect(),
    }
}
