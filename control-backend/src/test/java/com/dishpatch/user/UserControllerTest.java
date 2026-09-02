package com.dishpatch.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The signup and login endpoints as the control frontend calls them.
 *
 * <p>Unlike {@code OrderControllerTest} this wires a <em>real</em> {@link UserService}
 * over a mocked {@link UserRepository}, because the behaviour worth pinning spans both
 * layers: the status code is decided by the controller, but the guard that produces it
 * lives in the service. Mocking the service would assert nothing about either fix.
 *
 * <p>Two regressions are pinned here. Email uniqueness is enforced in the service, not
 * by the DynamoDB write — a PutItem condition expression is scoped to the item at the
 * key being written, and that key is a fresh UUID on every signup, so it can never see
 * a pre-existing row with the same address. And {@code login} was the one endpoint
 * without a try/catch, so a missing field escaped as a 500 rather than a 400: a null
 * email reached {@code AttributeValue.builder().s(null)} and a null password reached
 * {@code BCryptPasswordEncoder.matches}, both of which throw.
 */
class UserControllerTest {

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder();

    private UserRepository userRepository;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        mockMvc = MockMvcBuilders
                .standaloneSetup(new UserController(new UserService(userRepository)))
                .build();
    }

    /** A stored row as the repository returns it — password held as a bcrypt hash. */
    private static Map<String, Object> storedUser(String email, String rawPassword) {
        Map<String, Object> row = new HashMap<>();
        row.put("userId", "u-1");
        row.put("email", email);
        row.put("name", "Jane Doe");
        row.put("password", ENCODER.encode(rawPassword));
        return row;
    }

    // ── signup ───────────────────────────────────────────────────────────────

    @Test
    void rejectsSignupWhenTheEmailIsAlreadyRegistered() throws Exception {
        when(userRepository.findByEmail("taken@anu.edu.au"))
                .thenReturn(Optional.of(storedUser("taken@anu.edu.au", "whatever")));

        mockMvc.perform(post("/api/users/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fname":"Jane","lname":"Doe",
                                 "email":"taken@anu.edu.au","password":"pw123456"}"""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Email already exists"));

        // The row must never be written — the condition expression would not have
        // stopped it, since the UUID key is new every time.
        verify(userRepository, never()).addUser(
                anyString(), anyString(), anyString(), anyString(), any(), any());
    }

    @Test
    void createsTheAccountWhenTheEmailIsFree() throws Exception {
        when(userRepository.findByEmail("new@anu.edu.au")).thenReturn(Optional.empty());
        when(userRepository.addUser(anyString(), anyString(), anyString(), anyString(), any(), any()))
                .thenReturn(Optional.of(storedUser("new@anu.edu.au", "pw123456")));

        mockMvc.perform(post("/api/users/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fname":"Jane","lname":"Doe",
                                 "email":"new@anu.edu.au","password":"pw123456"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("new@anu.edu.au"))
                // The hash must never leave the backend.
                .andExpect(jsonPath("$.data.password").doesNotExist());
    }

    @Test
    void rejectsSignupWithAMalformedEmail() throws Exception {
        mockMvc.perform(post("/api/users/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fname":"Jane","lname":"Doe",
                                 "email":"not-an-email","password":"pw123456"}"""))
                .andExpect(status().isBadRequest());

        verify(userRepository, never()).findByEmail(anyString());
    }

    // ── login ────────────────────────────────────────────────────────────────

    @Test
    void returnsBadRequestWhenThePasswordIsMissing() throws Exception {
        // The address must resolve to a real row, or this never reaches the code that
        // used to blow up: it is BCryptPasswordEncoder.matches(null, hash) that throws,
        // and the filter only runs when the lookup found something.
        when(userRepository.findByEmail("jane@anu.edu.au"))
                .thenReturn(Optional.of(storedUser("jane@anu.edu.au", "correct-password")));

        mockMvc.perform(post("/api/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"jane@anu.edu.au"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Email and password are required"));

        // The guard must short-circuit before the lookup happens at all.
        verify(userRepository, never()).findByEmail(anyString());
    }

    @Test
    void returnsBadRequestWhenTheEmailIsMissing() throws Exception {
        mockMvc.perform(post("/api/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"password":"pw123456"}"""))
                .andExpect(status().isBadRequest());

        // A null email used to reach AttributeValue.builder().s(null), which marshals to
        // an empty union and is rejected by DynamoDB with a ValidationException — a 500
        // in production. A mocked repository cannot reproduce that rejection, so what
        // this pins is that the call never happens at all.
        verify(userRepository, never()).findByEmail(any());
    }

    @Test
    void returnsBadRequestWhenAFieldIsBlank() throws Exception {
        mockMvc.perform(post("/api/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"jane@anu.edu.au","password":"   "}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnsUnauthorizedWhenThePasswordIsWrong() throws Exception {
        when(userRepository.findByEmail("jane@anu.edu.au"))
                .thenReturn(Optional.of(storedUser("jane@anu.edu.au", "correct-password")));

        mockMvc.perform(post("/api/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"jane@anu.edu.au","password":"wrong-password"}"""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void signsInWithTheCorrectPassword() throws Exception {
        when(userRepository.findByEmail("jane@anu.edu.au"))
                .thenReturn(Optional.of(storedUser("jane@anu.edu.au", "correct-password")));

        mockMvc.perform(post("/api/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"jane@anu.edu.au","password":"correct-password"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.userId").value("u-1"))
                .andExpect(jsonPath("$.data.password").doesNotExist());
    }
}
