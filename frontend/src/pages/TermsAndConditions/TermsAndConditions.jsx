import React from "react";
import "./TermsAndConditions.css";

const TermsAndConditions = () => {
  return (
    <div className="terms-conditions-container">
      <h2>Terms of Use & Privacy Policy</h2>

      <section>
        <h3>1. Data Collection and Usage</h3>
        <p>
          We collect personal information such as name, email, age, gender,
          phone number, blood group, and medical history during registration to
          provide personalized healthcare services. This data is used for:
        </p>
        <ul>
          <li>Creating and managing your patient profile.</li>
          <li>Providing access to your electronic health records (EHR).</li>
          <li>
            Offering personalized health insights and medicine recommendations.
          </li>
          <li>Improving our services and developing new features.</li>
          <li>
            Communicating important updates and health-related information.
          </li>
        </ul>
        <p>
          Your data may be anonymized and aggregated for research and analytical
          purposes to improve public health insights, but your individual
          identity will not be disclosed.
        </p>
      </section>

      <section>
        <h3>2. Data Security</h3>
        <p>
          We are committed to protecting your personal and health information.
          We implement a variety of security measures, including encryption,
          access controls, and regular security audits, to safeguard your data
          from unauthorized access, alteration, disclosure, or destruction.
        </p>
        <p>
          However, no method of transmission over the internet or method of
          electronic storage is 100% secure. While we strive to use commercially
          acceptable means to protect your personal information, we cannot
          guarantee its absolute security.
        </p>
      </section>

      <section>
        <h3>3. Data Sharing</h3>
        <p>
          We do not sell, trade, or otherwise transfer your personally
          identifiable information to outside parties without your consent,
          except in the following circumstances:
        </p>
        <ul>
          <li>
            To trusted third parties who assist us in operating our website,
            conducting our business, or servicing you, so long as those parties
            agree to keep this information confidential.
          </li>
          <li>
            When we believe release is appropriate to comply with the law,
            enforce our site policies, or protect ours or others' rights,
            property, or safety.
          </li>
        </ul>
        <p>
          Doctors authorized by you (via unique code or QR scan) will have
          access to your patient data and EHR history for providing medical
          consultations and care.
        </p>
      </section>

      <section>
        <h3>4. User Rights</h3>
        <p>
          You have the right to access, update, correct, or delete your personal
          information at any time. You can manage your profile settings within
          your dashboard or contact our support team for assistance.
        </p>
        <p>
          You can also request a copy of your data or request to restrict its
          processing under certain conditions.
        </p>
      </section>

      <section>
        <h3>5. Changes to This Policy</h3>
        <p>
          We may update our Terms of Use and Privacy Policy from time to time.
          We will notify you of any changes by posting the new Policy on this
          page and updating the "Last updated" date.
        </p>
        <p>Last updated: October 11, 2025</p>
      </section>

      <section>
        <h3>6. Contact Us</h3>
        <p>
          If you have any questions about these Terms and Conditions or our
          Privacy Policy, please contact us at:
        </p>
        <p>Email: support@techmedix.com</p>
        <p>Phone: +1 (123) 456-7890</p>
      </section>
    </div>
  );
};

export default TermsAndConditions;
