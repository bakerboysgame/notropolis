import { View, TextInput, Text, Pressable } from 'react-native';
import { useRef, useState } from 'react';

interface CodeInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  error?: string;
}

export function CodeInput({ length = 6, value, onChange, error }: CodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(cleaned);
  };

  const digits = value.split('');

  return (
    <View>
      {/* Hidden actual input */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          position: 'absolute',
          opacity: 0,
          width: '100%',
          height: 48,
        }}
      />

      {/* Visual boxes */}
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        {Array(length)
          .fill(0)
          .map((_, index) => {
            const isActive = isFocused && index === value.length;
            const isFilled = index < value.length;

            return (
              <View
                key={index}
                className={`
                  w-12 h-14 rounded-lg border-2 items-center justify-center
                  ${isActive ? 'border-primary-500 bg-neutral-800' : ''}
                  ${isFilled && !isActive ? 'border-neutral-600 bg-neutral-800' : ''}
                  ${!isActive && !isFilled ? 'border-neutral-700 bg-neutral-900' : ''}
                  ${error ? 'border-red-500' : ''}
                `}
              >
                <Text className="text-white text-2xl font-bold">
                  {digits[index] || ''}
                </Text>
              </View>
            );
          })}
      </Pressable>

      {error && (
        <Text className="text-red-500 text-sm mt-2 text-center">{error}</Text>
      )}
    </View>
  );
}
