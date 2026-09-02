package com.dishpatch.user;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUser(@PathVariable String id) {
        return userService.getUser(id).map(user -> ResponseEntity.ok(new ApiResponse<>(true, null, user)))
            .orElseGet(() -> ResponseEntity.status(404).body(new ApiResponse<>(false, "User not found", null)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<Map<String, Object>>> login(@RequestBody LoginRequest request) {
        return userService.login(request.email(), request.password())
                .map(user -> ResponseEntity.ok(new ApiResponse<>(true, null, user)))
                .orElseGet(() -> ResponseEntity.status(401).body(new ApiResponse<>(false, "Invalid email or password", null)));
    }

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<Map<String, Object>>> signUp(@RequestBody SignUpRequest request) {
        try {
            return userService.signUp(
            UUID.randomUUID().toString(),
            request.email(),
            request.password(),
            (request.fname == null || request.fname.isBlank() ? "" : request.fname.trim()) + (request.lname == null || request.lname.isBlank() ? "" : " " + request.lname.trim()),
            null,
            null
        ).map(user -> ResponseEntity.ok(new ApiResponse<>(true, null, user)))
        .orElseGet(() -> ResponseEntity.status(409).body(new ApiResponse<>(false, "Email already exists", null)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse<>(false, e.getMessage(), null));
        }
    }

    /**
     * FIXME (broken, currently unreachable): always returns 409 — the condition
     * expression in {@link UserRepository#updateEmail} is unsatisfiable. See the note
     * there. Also note the path says "username" but this updates the email.
     */
    @PatchMapping("/update/username/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateEmail(@PathVariable String id, @RequestBody UpdateEmailRequest request) {
        try {
            return userService.updateEmail(
                id,
                request.email
            ).map(user -> ResponseEntity.ok(new ApiResponse<>(true, null, user)))
            .orElseGet(() -> ResponseEntity.status(409).body(new ApiResponse<>(false, "Email already exists", null)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse<>(false, e.getMessage(), null));
        }
    }

    /**
     * FIXME (broken, currently unreachable): cannot change a password — the request
     * carries only one password field, which is used both to verify and to store. See
     * the note on {@link UserService#updatePassword}; the fix needs a second field here.
     */
    @PatchMapping("/update/password/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updatePassword(@PathVariable String id, @RequestBody UpdatePasswordRequest request) {
        try {
            return userService.updatePassword(
                id,
                request.password
            ).map(user -> ResponseEntity.ok(new ApiResponse<>(true, null, user)))
            .orElseGet(() -> ResponseEntity.status(409).body(new ApiResponse<>(false, "Id fault", null)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse<>(false, e.getMessage(), null));
        }
    }

    public record ApiResponse<T>(
            boolean success,
            String message,
            T data
    ) {
    }

    public record LoginRequest(
            String email,
            String password
    ) {
    }

    public record SignUpRequest(
            String fname,
            String lname,
            String email,
            String password
    ) {
    }

    public record UpdateEmailRequest(String email) {}
    public record UpdatePasswordRequest(String password) {}

}