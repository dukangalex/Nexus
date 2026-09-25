#include <windows.h>

struct NexusTunState {
    HMODULE wintun = nullptr;
    bool running = false;
};

bool nexus_load_wintun(NexusTunState& state, const wchar_t* dllPath) {
    if (state.wintun != nullptr) return true;
    state.wintun = LoadLibraryW(dllPath);
    return state.wintun != nullptr;
}

void nexus_unload_wintun(NexusTunState& state) {
    if (state.wintun != nullptr) {
        FreeLibrary(state.wintun);
        state.wintun = nullptr;
    }
    state.running = false;
}
