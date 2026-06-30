
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerCountEntry {
    pub id: String,
    pub name: String,
    pub server_type: String,
    pub asn: String,
    pub asn_org: String,
    pub value: f64,
}

#[derive(Debug, Clone, Default)]
pub struct PlayerCountRegistry {
    environment: String,
    entries: Vec<PlayerCountEntry>,
}

impl PlayerCountRegistry {
    pub fn new(environment: impl Into<String>) -> Self {
        Self {
            environment: environment.into(),
            entries: Vec::new(),
        }
    }

    pub fn reset(&mut self) {
        self.entries.clear();
    }

    pub fn set(&mut self, entry: PlayerCountEntry) {
        self.entries.push(entry);
    }

    pub fn set_environment(&mut self, environment: impl Into<String>) {
        self.environment = environment.into();
    }

    pub fn encode(&self) -> String {
        super::encode::encode_player_count(&self.environment, &self.entries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reset_clears_entries() {
        let mut registry = PlayerCountRegistry::new("development");
        registry.set(PlayerCountEntry {
            id: "id".into(),
            name: "Test".into(),
            server_type: "PC".into(),
            asn: String::new(),
            asn_org: String::new(),
            value: 1.0,
        });
        registry.reset();
        let encoded = registry.encode();
        assert!(encoded.contains("# TYPE"));
        assert!(!encoded.contains("id="));
    }
}
