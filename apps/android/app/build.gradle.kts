/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import java.util.Properties
import org.gradle.api.GradleException

plugins {
    id("com.android.application")
}

val releaseProperties = Properties()
val releasePropertiesFile = rootProject.file("qgh-release.properties.local")

if (releasePropertiesFile.isFile) {
    releasePropertiesFile.inputStream().use(releaseProperties::load)
}

val releaseStoreFile = releaseProperties.getProperty("storeFile")
val releaseStorePassword = releaseProperties.getProperty("storePassword")
val releaseKeyAlias = releaseProperties.getProperty("keyAlias")
val releaseKeyPassword = releaseProperties.getProperty("keyPassword")
val hasReleaseSigning = listOf(
    releaseStoreFile,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword
).all { !it.isNullOrBlank() }

if (releasePropertiesFile.isFile && !hasReleaseSigning) {
    throw GradleException(
        "qgh-release.properties.local exists but is missing a signing value. " +
            "Use qgh-release.properties.example as the complete template."
    )
}

android {
    namespace = "in.qgh.simulator"
    compileSdk = 36

    defaultConfig {
        applicationId = "in.qgh.simulator"
        minSdk = 26
        targetSdk = 36
        versionCode = 49
        versionName = "1.0.8"
    }

    buildTypes {
        if (hasReleaseSigning) {
            signingConfigs.create("release") {
                storeFile = rootProject.file(requireNotNull(releaseStoreFile))
                storePassword = requireNotNull(releaseStorePassword)
                keyAlias = requireNotNull(releaseKeyAlias)
                keyPassword = requireNotNull(releaseKeyPassword)
            }
        }

        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.activity:activity:1.13.0")
    implementation("androidx.webkit:webkit:1.17.0")
    implementation("com.alphacephei:vosk-android:0.3.75")
}

val releaseSigningRequiredTasks = setOf(
    "packageRelease",
    "packageReleaseBundle",
    "signReleaseBundle"
)

tasks.configureEach {
    if (name in releaseSigningRequiredTasks) {
        doFirst {
            check(hasReleaseSigning) {
                "Release signing is required. Create qgh-release.properties.local from " +
                    "qgh-release.properties.example before producing a production artifact."
            }
        }
    }
}
