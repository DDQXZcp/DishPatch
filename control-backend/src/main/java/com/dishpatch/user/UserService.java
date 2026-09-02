package com.dishpatch.user;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.HashMap;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class UserService {
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = new BCryptPasswordEncoder();
    }

    private String hashPassword(String rawPassword) {
        return passwordEncoder.encode(rawPassword);
    }

    private boolean matches(String rawPassword, String storedHash) {
        return passwordEncoder.matches(rawPassword, storedHash);
    }

    private static boolean validEmail(String email) {
        return email != null && Pattern.matches("\\S+@\\S+\\.\\S+", email);
    }

    private Map<String, Object> cleanResponse(Map<String, Object> response) {
        Map<String, Object> copy = new HashMap<>(response);
        copy.remove("password");
        return copy;
    }

    public Optional<Map<String, Object>> signUp(String userId, String email, String password, String name, String phone, String role) {
        if (!validEmail(email)) {
            throw new IllegalArgumentException("Invalid email: " + email);
        }

        String hashedPassword = hashPassword(password);
        return userRepository.addUser(userId, email, hashedPassword, name, phone, role).map(this::cleanResponse);
    }

    public Optional<Map<String, Object>> login(String email, String password) {
        return userRepository.findByEmail(email).filter(user -> matches(password, (String) user.get("password"))).map(this::cleanResponse);
    }

    public Optional<Map<String, Object>> updateEmail(String userId, String email) {
        if (!validEmail(email)) {
            throw new IllegalArgumentException("Invalid email: " + email);
        }

        return userRepository.updateEmail(userId, email).map(this::cleanResponse);
    }

    /**
     * FIXME (broken, currently unreachable): this cannot change a password.
     *
     * <p>Only one password is passed in, and it is used for both roles — it is
     * compared against the stored hash, and then re-hashed and written back. So a
     * genuinely new password fails the check and throws ("Invalid password" → 400),
     * and the only input that succeeds is the password already on the account, which
     * is then stored again under a fresh salt. Net effect: a no-op.
     *
     * <p>Fix: take {@code currentPassword} and {@code newPassword} separately —
     * {@code matches(currentPassword, stored)} then {@code hashPassword(newPassword)}.
     * {@code UpdatePasswordRequest} needs the second field.
     *
     * <p>Deferred because nothing calls PATCH /api/users/update/password/{id} — the
     * frontend has no edit-profile UI. This becomes blocking as soon as one is built.
     * Note the endpoint is still publicly reachable and, in this state, reports
     * whether a guessed password is correct (200 vs 400) for any known userId.
     */
    public Optional<Map<String, Object>> updatePassword(String userId, String password) {
        Optional<Map<String, Object>> result = userRepository.findById(userId);

        if (result.isPresent()) {
            Map<String, Object> user = result.get();

            if (!matches(password, (String) user.get("password"))) {
                throw new IllegalArgumentException("Invalid password");
            }

            String hashedPassword = hashPassword(password);
            return userRepository.updatePassword(userId, hashedPassword).map(this::cleanResponse);
        }
        
        return Optional.empty();
    }

    public Optional<Map<String, Object>> getUser(String userId) {
        return userRepository.findById(userId).map(this::cleanResponse);
    }
    

}