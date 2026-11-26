package ir.navanegar.radif;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

import java.util.ArrayList;
import java.util.List;

import ir.navanegar.radif.billing.NavanegarBillingPlugin;

public class MainActivity extends BridgeActivity {
    private static final int REQUEST_CODE_JIT_AUDIO = 4109;
    private PermissionRequest pendingWebAudioRequest = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NavanegarBillingPlugin.class);
        super.onCreate(savedInstanceState);

        // NOTE: Intentionally DO NOT request RECORD_AUDIO in onCreate().
        // Microphone permission is requested strictly Just-In-Time inside
        // WebChromeClient.onPermissionRequest when the user explicitly activates
        // the tuner, live DSP console, voice placement test, or recorder.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> handleJustInTimeWebPermission(request));
                }
            });
        }
    }

    private void handleJustInTimeWebPermission(PermissionRequest request) {
        String[] resources = request.getResources();
        boolean needsAudio = false;
        for (String res : resources) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                needsAudio = true;
                break;
            }
        }

        if (!needsAudio) {
            request.deny();
            return;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            if (pendingWebAudioRequest != null) {
                pendingWebAudioRequest.deny();
            }
            pendingWebAudioRequest = request;
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    REQUEST_CODE_JIT_AUDIO
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        if (requestCode == REQUEST_CODE_JIT_AUDIO && pendingWebAudioRequest != null) {
            PermissionRequest req = pendingWebAudioRequest;
            pendingWebAudioRequest = null;

            boolean granted = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;

            if (granted) {
                List<String> audioOnly = new ArrayList<>();
                audioOnly.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                req.grant(audioOnly.toArray(new String[0]));
            } else {
                req.deny();
            }
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }
}
