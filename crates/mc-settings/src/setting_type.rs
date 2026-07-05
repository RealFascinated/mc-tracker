use serde_json::Value;

pub trait SettingType: Send + Sync {
    fn name(&self) -> &'static str;
    fn validate(&self, value: &Value) -> Result<(), String>;
    fn parse_stored(&self, raw: &str) -> Result<Value, String>;
    fn serialize_stored(&self, value: &Value) -> Result<String, String>;
}

pub struct BooleanType;

impl SettingType for BooleanType {
    fn name(&self) -> &'static str {
        "BOOLEAN"
    }

    fn validate(&self, value: &Value) -> Result<(), String> {
        if value.is_boolean() {
            Ok(())
        } else {
            Err("expected boolean value".into())
        }
    }

    fn parse_stored(&self, raw: &str) -> Result<Value, String> {
        match raw {
            "true" => Ok(Value::Bool(true)),
            "false" => Ok(Value::Bool(false)),
            other => Err(format!("expected true or false, got {other}")),
        }
    }

    fn serialize_stored(&self, value: &Value) -> Result<String, String> {
        match value.as_bool() {
            Some(true) => Ok("true".into()),
            Some(false) => Ok("false".into()),
            None => Err("expected boolean value".into()),
        }
    }
}

pub struct StringType;

impl SettingType for StringType {
    fn name(&self) -> &'static str {
        "STRING"
    }

    fn validate(&self, value: &Value) -> Result<(), String> {
        if value.is_string() {
            Ok(())
        } else {
            Err("expected string value".into())
        }
    }

    fn parse_stored(&self, raw: &str) -> Result<Value, String> {
        Ok(Value::String(raw.to_string()))
    }

    fn serialize_stored(&self, value: &Value) -> Result<String, String> {
        value
            .as_str()
            .map(str::to_owned)
            .ok_or_else(|| "expected string value".into())
    }
}

pub struct IntegerType;

impl SettingType for IntegerType {
    fn name(&self) -> &'static str {
        "INTEGER"
    }

    fn validate(&self, value: &Value) -> Result<(), String> {
        if value.as_u64().is_some() {
            Ok(())
        } else {
            Err("expected integer value".into())
        }
    }

    fn parse_stored(&self, raw: &str) -> Result<Value, String> {
        let n: u64 = raw.parse().map_err(|_| format!("invalid integer: {raw}"))?;
        Ok(Value::Number(n.into()))
    }

    fn serialize_stored(&self, value: &Value) -> Result<String, String> {
        value
            .as_u64()
            .map(|n| n.to_string())
            .ok_or_else(|| "expected integer value".into())
    }
}

pub struct EnumType {
    pub allowed: &'static [&'static str],
}

impl SettingType for EnumType {
    fn name(&self) -> &'static str {
        "ENUM"
    }

    fn validate(&self, value: &Value) -> Result<(), String> {
        let Some(s) = value.as_str() else {
            return Err("expected string value".into());
        };
        if self.allowed.contains(&s) {
            Ok(())
        } else {
            Err(format!(
                "invalid value: {s}; expected one of: {}",
                self.allowed.join(", ")
            ))
        }
    }

    fn parse_stored(&self, raw: &str) -> Result<Value, String> {
        let value = Value::String(raw.to_string());
        self.validate(&value)?;
        Ok(value)
    }

    fn serialize_stored(&self, value: &Value) -> Result<String, String> {
        let s = value
            .as_str()
            .ok_or_else(|| "expected string value".to_string())?;
        self.validate(value)?;
        Ok(s.to_string())
    }
}

pub struct StringListType;

impl SettingType for StringListType {
    fn name(&self) -> &'static str {
        "STRING_LIST"
    }

    fn validate(&self, value: &Value) -> Result<(), String> {
        let Some(items) = value.as_array() else {
            return Err("expected array value".into());
        };
        if items.is_empty() {
            return Err("expected at least one entry".into());
        }
        for item in items {
            let Some(text) = item.as_str() else {
                return Err("expected string array".into());
            };
            if text.trim().is_empty() {
                return Err("entries must not be empty".into());
            }
        }
        Ok(())
    }

    fn parse_stored(&self, raw: &str) -> Result<Value, String> {
        let value: Value =
            serde_json::from_str(raw).map_err(|err| format!("invalid JSON array: {err}"))?;
        self.validate(&value)?;
        Ok(value)
    }

    fn serialize_stored(&self, value: &Value) -> Result<String, String> {
        self.validate(value)?;
        serde_json::to_string(value).map_err(|err| err.to_string())
    }
}

pub static BOOLEAN: BooleanType = BooleanType;
pub static STRING: StringType = StringType;
pub static INTEGER: IntegerType = IntegerType;
pub static STRING_LIST: StringListType = StringListType;

pub static ENUM_LLM_PROVIDER: EnumType = EnumType {
    allowed: &["llama_cpp", "openrouter", "openai_compatible"],
};
