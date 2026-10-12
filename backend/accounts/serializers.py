from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers

INVALID_CREDENTIALS_MESSAGE = "Unable to log in with the provided credentials."


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ["id", "username"]
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["username"],
            password=attrs["password"],
        )
        # Same message for unknown user, wrong password and inactive account.
        if user is None:
            raise serializers.ValidationError(INVALID_CREDENTIALS_MESSAGE, code="authorization")
        attrs["user"] = user
        return attrs
