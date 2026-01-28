//! Audio capture module for microphone and system audio.
//!
//! Uses cpal for cross-platform audio capture.
//! On Windows, can use WASAPI loopback for system audio.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

use crate::logging;

/// Audio device information.
#[derive(Debug, Serialize, Deserialize)]
pub struct AudioDevice {
    /// Device name.
    pub name: String,
    /// Whether this is the default device.
    pub is_default: bool,
    /// Device type (input/output).
    pub device_type: String,
}

/// Audio stream configuration.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioStreamConfig {
    /// Sample rate in Hz.
    pub sample_rate: u32,
    /// Number of channels.
    pub channels: u16,
    /// Speaker label for this stream.
    pub speaker: String,
}

/// Audio chunk payload for the frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioChunk {
    /// Speaker label for this chunk.
    pub speaker: String,
    /// Raw PCM bytes (16-bit LE).
    pub data: Vec<u8>,
}

/// Global flags to control audio capture.
static CAPTURING_MIC: AtomicBool = AtomicBool::new(false);
static CAPTURING_LOOPBACK: AtomicBool = AtomicBool::new(false);

/// Start audio capture from microphone and system audio.
///
/// # Arguments
///
/// * `window` - Tauri window handle for emitting events.
///
/// # Returns
///
/// Result indicating success or error message.
#[tauri::command]
pub async fn start_capture(window: tauri::Window) -> Result<AudioStreamConfig, String> {
    start_microphone_capture(window).await
}

/// Start microphone audio capture using CPAL.
#[tauri::command]
pub async fn start_microphone_capture(
    window: tauri::Window,
) -> Result<AudioStreamConfig, String> {
    use cpal::traits::{DeviceTrait, HostTrait};

    if CAPTURING_MIC.load(Ordering::SeqCst) {
        return Err("Microphone capture already active".to_string());
    }

    logging::append_log("Starting microphone capture");
    CAPTURING_MIC.store(true, Ordering::SeqCst);

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No input device available")?;
    let config = device.default_input_config().map_err(|e| e.to_string())?;
    let stream_config: cpal::StreamConfig = config.clone().into();

    let info = AudioStreamConfig {
        sample_rate: stream_config.sample_rate.0,
        channels: stream_config.channels,
        speaker: "user".to_string(),
    };

    // Spawn audio capture thread
    let window_clone = window.clone();
    let device_clone = device;
    let config_clone = config;
    std::thread::spawn(move || {
        let window_for_error = window_clone.clone();
        if let Err(e) = capture_audio_loop(window_clone, device_clone, config_clone) {
            eprintln!("Audio capture error: {}", e);
            logging::append_log(&format!("Microphone capture error: {e}"));
            let _ = window_for_error.emit("audio-error", e.to_string());
        }
    });

    let _ = window.emit("audio-config", info.clone());

    Ok(info)
}

/// Start system audio capture using WASAPI loopback.
///
/// # Arguments
///
/// * `window` - Tauri window handle for emitting events.
///
/// # Returns
///
/// Stream configuration for the captured audio.
#[tauri::command]
pub async fn start_loopback_capture(window: tauri::Window) -> Result<AudioStreamConfig, String> {
    if CAPTURING_LOOPBACK.load(Ordering::SeqCst) {
        return Err("Loopback capture already active".to_string());
    }

    logging::append_log("Starting loopback capture");
    CAPTURING_LOOPBACK.store(true, Ordering::SeqCst);

    let window_clone = window.clone();
    std::thread::spawn(move || {
        let window_for_error = window_clone.clone();
        if let Err(e) = capture_loopback_audio(window_clone) {
            eprintln!("Loopback capture error: {}", e);
            logging::append_log(&format!("Loopback capture error: {e}"));
            let _ = window_for_error.emit("audio-error", e.to_string());
        }
    });

    // We cannot know the exact format synchronously; emit a default config
    // and the real config will be sent with the first chunks.
    Ok(AudioStreamConfig {
        sample_rate: 48000,
        channels: 2,
        speaker: "other".to_string(),
    })
}

/// Stop audio capture.
///
/// # Returns
///
/// Result indicating success or error message.
#[tauri::command]
pub async fn stop_capture() -> Result<(), String> {
    CAPTURING_MIC.store(false, Ordering::SeqCst);
    CAPTURING_LOOPBACK.store(false, Ordering::SeqCst);
    logging::append_log("Audio capture stopped");
    Ok(())
}

/// Get list of available audio devices.
///
/// # Returns
///
/// List of audio devices or error message.
#[tauri::command]
pub async fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let host = cpal::default_host();
    let mut devices = Vec::new();

    // Get input devices (microphones)
    if let Ok(input_devices) = host.input_devices() {
        let default_input = host.default_input_device();

        for device in input_devices {
            if let Ok(name) = device.name() {
                let is_default = default_input
                    .as_ref()
                    .map(|d| d.name().ok() == Some(name.clone()))
                    .unwrap_or(false);

                devices.push(AudioDevice {
                    name,
                    is_default,
                    device_type: "input".to_string(),
                });
            }
        }
    }

    Ok(devices)
}

/// Main audio capture loop.
///
/// Captures audio from the default input device and sends it to the frontend.
fn capture_audio_loop(
    window: tauri::Window,
    device: cpal::Device,
    config: cpal::SupportedStreamConfig,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use cpal::traits::{DeviceTrait, StreamTrait};
    use cpal::SampleFormat;

    println!("Using input device: {}", device.name()?);
    println!("Default input config: {:?}", config);

    let stream_config: cpal::StreamConfig = config.clone().into();
    let sample_rate = stream_config.sample_rate.0;
    let channels = stream_config.channels as usize;
    let sample_format = config.sample_format();

    // Buffer for collecting audio samples
    let mut buffer: Vec<i16> = Vec::with_capacity(sample_rate as usize);

    let window_clone = window.clone();

    let chunk_size = (sample_rate as usize / 10) * channels;

    let stream = match sample_format {
        SampleFormat::F32 => device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !CAPTURING_MIC.load(Ordering::SeqCst) {
                    return;
                }

                for &sample in data {
                    let sample_i16 = (sample * 32767.0)
                        .clamp(i16::MIN as f32, i16::MAX as f32) as i16;
                    buffer.push(sample_i16);
                }

                if buffer.len() >= chunk_size {
                    let bytes: Vec<u8> = buffer
                        .iter()
                        .flat_map(|&s| s.to_le_bytes())
                        .collect();
                    let payload = AudioChunk {
                        speaker: "user".to_string(),
                        data: bytes,
                    };
                    let _ = window_clone.emit("audio-chunk", payload);
                    buffer.clear();
                }
            },
            |err| {
                eprintln!("Audio stream error: {}", err);
            },
            None,
        )?,
        SampleFormat::I16 => device.build_input_stream(
            &stream_config,
            move |data: &[i16], _: &cpal::InputCallbackInfo| {
                if !CAPTURING_MIC.load(Ordering::SeqCst) {
                    return;
                }

                buffer.extend_from_slice(data);

                if buffer.len() >= chunk_size {
                    let bytes: Vec<u8> = buffer
                        .iter()
                        .flat_map(|&s| s.to_le_bytes())
                        .collect();
                    let payload = AudioChunk {
                        speaker: "user".to_string(),
                        data: bytes,
                    };
                    let _ = window_clone.emit("audio-chunk", payload);
                    buffer.clear();
                }
            },
            |err| {
                eprintln!("Audio stream error: {}", err);
            },
            None,
        )?,
        SampleFormat::U16 => device.build_input_stream(
            &stream_config,
            move |data: &[u16], _: &cpal::InputCallbackInfo| {
                if !CAPTURING_MIC.load(Ordering::SeqCst) {
                    return;
                }

                for &sample in data {
                    let sample_i16 = (sample as i32 - 32768) as i16;
                    buffer.push(sample_i16);
                }

                if buffer.len() >= chunk_size {
                    let bytes: Vec<u8> = buffer
                        .iter()
                        .flat_map(|&s| s.to_le_bytes())
                        .collect();
                    let payload = AudioChunk {
                        speaker: "user".to_string(),
                        data: bytes,
                    };
                    let _ = window_clone.emit("audio-chunk", payload);
                    buffer.clear();
                }
            },
            |err| {
                eprintln!("Audio stream error: {}", err);
            },
            None,
        )?,
        _ => {
            return Err(format!("Unsupported sample format: {:?}", sample_format).into());
        }
    };

    stream.play()?;

    // Keep stream alive while capturing
    while CAPTURING_MIC.load(Ordering::SeqCst) {
        std::thread::sleep(std::time::Duration::from_millis(100));
    }

    Ok(())
}

/// Capture system audio via WASAPI loopback and emit chunks.
fn capture_loopback_audio(
    window: tauri::Window,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use wasapi::{initialize_mta, DeviceEnumerator, Direction, StreamMode};

    if let Err(err) = initialize_mta().ok() {
        return Err(format!("COM init failed: {err:?}").into());
    }

    let enumerator = DeviceEnumerator::new()?;
    let device = enumerator.get_default_device(&Direction::Render)?;
    let mut audio_client = device.get_iaudioclient()?;

    let wave_format = audio_client.get_mixformat()?;
    let sample_rate = wave_format.wave_fmt.Format.nSamplesPerSec as u32;
    let channels = wave_format.wave_fmt.Format.nChannels as u16;

    // Notify frontend about the actual stream config
    let _ = window.emit(
        "audio-config",
        AudioStreamConfig {
            sample_rate,
            channels,
            speaker: "other".to_string(),
        },
    );

    let mode = StreamMode::PollingShared {
        autoconvert: true,
        buffer_duration_hns: 200_000, // 20ms
    };
    audio_client.initialize_client(&wave_format, &Direction::Capture, &mode)?;

    let capture_client = audio_client.get_audiocaptureclient()?;
    let bytes_per_frame = wave_format.get_blockalign() as usize;

    audio_client.start_stream()?;

    while CAPTURING_LOOPBACK.load(Ordering::SeqCst) {
        let frames = capture_client
            .get_next_packet_size()?
            .unwrap_or(0);
        if frames == 0 {
            std::thread::sleep(std::time::Duration::from_millis(10));
            continue;
        }

        let mut buffer = vec![0u8; frames as usize * bytes_per_frame];
        let (frames_read, _) = capture_client.read_from_device(&mut buffer)?;
        if frames_read > 0 {
            let byte_len = frames_read as usize * bytes_per_frame;
            buffer.truncate(byte_len);
            let payload = AudioChunk {
                speaker: "other".to_string(),
                data: buffer,
            };
            let _ = window.emit("audio-chunk", payload);
        }
    }

    audio_client.stop_stream()?;
    Ok(())
}
