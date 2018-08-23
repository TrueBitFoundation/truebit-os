#include <stdio.h>
#include <stdlib.h>

int main() {
    FILE *input_file = fopen("alphabet.txt", "r");

    if (input_file == NULL) {
	fprintf(stderr, "Can't open input file!\n");
	exit(1);
    }

    //read in alphabet
    char *alphabet = malloc(26 * sizeof(char));
    int i = 0;
    int c;

    while((c = fgetc(input_file)) != EOF) {
	alphabet[i] = (char) c;
	i++;
    }

    fclose(input_file);

    FILE *output_file = fopen("reverse_alphabet.txt", "w");

    if(output_file == NULL) {
	fprintf(stderr, "Can't open output file!\n");
	exit(1);
    }

    for(int j = 25; j >= 0; j--) {
    	fputc(alphabet[j], output_file);
    }

    free(alphabet);
    
    fclose(output_file);
}
